#!/usr/bin/env python3
"""Real HTTP/SQL integration tests in a temporary copy. Never touches the live demo.

Default: SQLite. To also test MySQL, provide PUNTO_TEST_MYSQL_DSN (empty dedicated DB),
PUNTO_TEST_MYSQL_USER and PUNTO_TEST_MYSQL_PASSWORD. The test refuses a nonempty DB.
"""
import base64, http.cookiejar, json, os, pathlib, shutil, socket, subprocess, tempfile, time, urllib.request, urllib.error, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
checks=0
def check(condition, message):
    global checks
    assert condition,message
    checks+=1
def php(root, args, env, success=True):
    p=subprocess.run(['php',*args],cwd=root,env=env,capture_output=True,text=True)
    if success and p.returncode: raise AssertionError(p.stderr+p.stdout)
    return p
class Client:
    def __init__(self,url):
        self.url=url;self.csrf='';self.cookies=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self,action,data=None,status=200,token=None,raw=False,query=''):
        headers={'Accept':'application/json'}
        if data is not None:
            headers.update({'Content-Type':'application/json','X-CSRF-Token':self.csrf if token is None else token})
            data=json.dumps(data).encode()
        req=urllib.request.Request(self.url+'/api.php?action='+action+query,data=data,headers=headers)
        try:r=self.opener.open(req)
        except urllib.error.HTTPError as e:r=e
        body=r.read();check(r.code==status,f'{action}: expected {status}, got {r.code}: {body[:300]!r}')
        if raw:return body
        result=json.loads(body)
        if 'csrf' in result:self.csrf=result['csrf']
        return result
    def upload(self,project,name,mime,content,status=201):
        boundary='punto-test-boundary-785124'
        body=b''
        for key,value in {'project_id':project,'title':'Consegna di collaudo'}.items():
            body+=f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
        body+=f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+content+f'\r\n--{boundary}--\r\n'.encode()
        req=urllib.request.Request(self.url+'/api.php?action=delivery_upload',data=body,headers={'Content-Type':f'multipart/form-data; boundary={boundary}','X-CSRF-Token':self.csrf})
        try:r=self.opener.open(req)
        except urllib.error.HTTPError as e:r=e
        result=json.loads(r.read());check(r.code==status,f'upload: {r.code}: {result}')
        return result
    def login_demo(self,role):self.call('state');self.call('demo',{'role':role});return self.call('state')
def run(driver,dsn=None):
    before=checks
    with tempfile.TemporaryDirectory(prefix='punto-integration-') as temp:
        root=pathlib.Path(temp)/'app';root.mkdir()
        for name in ['app','bin','database','public']:
            shutil.copytree(ROOT/name,root/name)
        shutil.copy2(ROOT/'router.php',root/'router.php');(root/'storage').mkdir()
        env=os.environ.copy();env.update(APP_ENV='demo',ADMIN_EMAIL='test@example.test',ADMIN_NAME='Test Admin',ADMIN_PASSWORD='A-private-test-password-2026')
        env['DB_DSN']=dsn or 'sqlite:'+str(root/'storage/test.sqlite')
        env['DB_USER']=os.getenv('PUNTO_TEST_MYSQL_USER','root') if dsn else ''
        env['DB_PASSWORD']=os.getenv('PUNTO_TEST_MYSQL_PASSWORD','') if dsn else ''
        php(root,['bin/setup.php','--demo'],env)
        check(php(root,['bin/setup.php','--demo'],env,False).returncode!=0,'Must refuse reinstall')
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        log=open(pathlib.Path(temp)/'server.log','w+')
        server=subprocess.Popen(['php','-d','upload_max_filesize=6M','-d','post_max_size=7M','-S',f'127.0.0.1:{port}','-t','public','router.php'],cwd=root,env=env,stdout=log,stderr=log)
        url=f'http://127.0.0.1:{port}'
        try:
            for _ in range(60):
                try:urllib.request.urlopen(url);break
                except urllib.error.URLError:time.sleep(.05)
            anon=Client(url);admin=Client(url);member=Client(url);client=Client(url)
            check(anon.call('state')['user'] is None,'Anonymous state')
            anon.call('project',status=401,query='&id=unknown')
            anon.call('demo',{'role':'admin'},status=419,token='bad')
            anon.call('login',{'email':'test@example.test','password':'wrong'},status=401)
            anon.call('login',{'email':'test@example.test','password':env['ADMIN_PASSWORD']})
            check(anon.call('state')['user']['role']=='admin','Password login')
            anon.call('logout',{})
            a=admin.login_demo('admin');m=member.login_demo('member');c=client.login_demo('client')
            check(len(a['projects'])==3 and len(m['projects'])==2 and len(c['projects'])==1,'Role project scopes')
            forbidden=next(p for p in a['projects'] if p['id'] not in [p['id'] for p in m['projects']])
            member.call('project',query='&id='+forbidden['id'],status=403)
            client.call('project',query='&id='+forbidden['id'],status=403)
            client.call('client_create',{'name':'No'},status=403)
            member.call('user_create',{'name':'No'},status=403)
            req=client.call('request_create',{'title':'=SUM(1+1)','description':'Collaudo del percorso completo','priority':'high'},201)
            cid=c['user']['client_id'];mid=m['user']['id']
            client.call('request_convert',{'id':req['id'],'version':1},403)
            admin.call('request_convert',{'id':req['id'],'version':9},409)
            check(len(admin.call('state')['projects'])==3,'Failed conversion rolls back')
            project=admin.call('request_convert',{'id':req['id'],'version':1,'member_id':mid,'budget_minutes':120})
            pid=project['id']
            admin.call('request_convert',{'id':req['id'],'version':1},409)
            member.call('project',query='&id='+pid)
            client.call('project',query='&id='+pid)
            admin.call('task_create',{'project_id':pid,'title':'No date','due_date':'2026-02-30'},422)
            task=member.call('task_create',{'project_id':pid,'title':'Verifica finale','description':'Un caso reale','assignee_id':mid,'estimate_minutes':90},201)
            tid=task['id']
            client.call('task_update',{'id':tid,'version':1,'title':'No'},403)
            member.call('task_status',{'id':tid,'version':1,'status':'done'},403)
            member.call('task_status',{'id':tid,'version':1,'status':'doing'})
            member.call('task_status',{'id':tid,'version':1,'status':'review'},409)
            member.call('task_status',{'id':tid,'version':2,'status':'review'})
            client.call('task_comment',{'task_id':tid,'body':'<script>alert(1)</script> Va bene.'},201)
            taskdetail=admin.call('task',query='&id='+tid)
            check(taskdetail['comments'][0]['body'].startswith('<script>'),'Text preserved as data')
            client.call('task_status',{'id':tid,'version':3,'status':'done'})
            member.call('task_update',{'id':tid,'version':4,'title':'Tamper'},409)
            member.call('time_create',{'project_id':pid,'task_id':tid,'minutes':60,'work_date':'2099-01-01','note':'Future'},422)
            member.call('time_create',{'project_id':pid,'task_id':forbidden['id'],'minutes':60,'work_date':time.strftime('%Y-%m-%d'),'note':'Cross scope'},422)
            member.call('time_create',{'project_id':pid,'task_id':tid,'minutes':60,'work_date':time.strftime('%Y-%m-%d'),'note':'Collaudo'},201)
            client.call('time_create',{'project_id':pid,'minutes':60},403)
            admin.call('project_update',{'project_id':pid,'version':1,'status':'completed'},409)
            member.upload(pid,'bad.php','application/pdf',b'<?php echo "bad";',422)
            pdf=b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'
            delivery=member.upload(pid,'consegna.pdf','application/pdf',pdf)
            fid=delivery['id'];check(delivery['revision']==1,'First delivery version')
            check(client.call('download',query='&id='+fid,raw=True)==pdf,'Scoped file download')
            anon.call('download',query='&id='+fid,status=401)
            admin.call('delivery_review',{'project_id':pid,'id':fid,'version':1,'status':'approved'},403)
            client.call('delivery_review',{'project_id':pid,'id':fid,'version':1,'status':'changes','feedback':''},422)
            client.call('delivery_review',{'project_id':pid,'id':fid,'version':1,'status':'changes','feedback':'Aggiungi il riepilogo.'})
            client.call('delivery_review',{'project_id':pid,'id':fid,'version':1,'status':'approved'},409)
            second=member.upload(pid,'consegna-v2.pdf','application/pdf',pdf)
            check(second['revision']==2,'Second delivery revision')
            client.call('delivery_review',{'project_id':pid,'id':second['id'],'version':1,'status':'approved','feedback':'Confermato.'})
            fresh=admin.call('project',query='&id='+pid)['project']
            admin.call('project_update',{'project_id':pid,'version':fresh['version'],'status':'completed'})
            member.call('task_create',{'project_id':pid,'title':'Closed'},409)
            client.call('task_comment',{'task_id':tid,'body':'Closed'},409)
            csv=admin.call('export',raw=True).decode('utf-8-sig');check("'=SUM(1+1)" in csv,'CSV formula injection neutralized')
            report=next(r for r in admin.call('state')['report'] if r['id']==pid)
            check(report['minutes']==60 and report['done']==1 and report['status']=='completed','Real report aggregation')
            # Another client's delivery cannot be read, even with a known id.
            other=member.upload(next(p['id'] for p in m['projects'] if p['client_id']!=cid),'other.pdf','application/pdf',pdf)
            client.call('download',query='&id='+other['id'],status=403)
            for path in ['/config.php','/storage/accesso.txt','/app/bootstrap.php','/database/schema.sql']:
                try:r=urllib.request.urlopen(url+path)
                except urllib.error.HTTPError as e:r=e
                check(r.code==404,'Private path not served: '+path)
            old=admin.csrf
            admin.call('password_change',{'current_password':'wrong','password':'A-new-password-123'},422)
            admin.call('password_change',{'current_password':env['ADMIN_PASSWORD'],'password':'A-new-password-123'})
            check(admin.csrf!=old,'Password change rotates CSRF')
            admin.call('logout',{})
            admin.call('login',{'email':env['ADMIN_EMAIL'],'password':'A-new-password-123'})
            php(root,['bin/backup.php'],env)
            backup=next((root/'storage/backups').glob('*.zip'))
            with zipfile.ZipFile(backup) as z:
                manifest=json.loads(z.read('database.json'));check(len(manifest['tables']['deliverables'])==3,'Backup includes delivery records')
                check(len([n for n in z.namelist() if n.startswith('uploads/')])==3,'Backup includes private files')
            restore=pathlib.Path(temp)/'restored';shutil.copytree(root,restore,ignore=shutil.ignore_patterns('storage','config.php'));(restore/'storage').mkdir()
            renv={**env,'DB_DSN':'sqlite:'+str(restore/'storage/restored.sqlite'),'DB_USER':'','DB_PASSWORD':''}
            php(restore,['bin/restore.php',str(backup),'--empty-database'],renv)
            result=php(restore,['-r',"require 'app/bootstrap.php'; echo Punto\\query('SELECT COUNT(*) FROM deliverables')->fetchColumn();"],renv)
            check(result.stdout.strip()=='3','Restore data roundtrip')
            check(len(list((restore/'storage/uploads').iterdir()))==3,'Restore files roundtrip')
            check(php(restore,['bin/restore.php',str(backup),'--empty-database'],renv,False).returncode!=0,'Refuses destructive restore')
            # A production server must not expose the demo login shortcut.
            server.terminate();server.wait();env['APP_ENV']='production'
            server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t','public','router.php'],cwd=root,env=env,stdout=log,stderr=log)
            for _ in range(60):
                try:urllib.request.urlopen(url);break
                except urllib.error.URLError:time.sleep(.05)
            prod=Client(url);check(prod.call('state')['demo'] is False,'Demo disabled in production')
            prod.call('demo',{'role':'admin'},403)
            log.flush();log.seek(0);check('Fatal error' not in log.read(),'No server fatal errors')
        finally:
            server.terminate();server.wait(timeout=5);log.close()
    print(f'{driver}: {checks-before} checks passed')
run('SQLite')
if os.getenv('PUNTO_TEST_MYSQL_DSN'):run('MySQL/MariaDB',os.environ['PUNTO_TEST_MYSQL_DSN'])
print(f'Total: {checks} checks passed')
