#!/usr/bin/env python3
"""Exercise the shared-hosting bundle and one-time installer in a disposable local server.
Apache access rules must also be verified on the actual target before activation.
"""
import hashlib, http.cookiejar, json, os, pathlib, re, socket, sqlite3, subprocess, tempfile, time, urllib.parse, urllib.request, urllib.error, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='punto-hosting-') as temp:
 folder=pathlib.Path(temp);config=folder/'hosting.php';db=folder/'test.sqlite'
 config.write_text("<?php return ['DB_DSN'=>'sqlite:"+str(db)+"','DB_TABLE_PREFIX'=>'punto_'];")
 with sqlite3.connect(db) as c:c.execute('CREATE TABLE other_app(note TEXT)');c.execute("INSERT INTO other_app VALUES('untouched')")
 out=folder/'release'
 subprocess.run(['python3',str(ROOT/'bin/build-hosting.py'),'--config',str(config),'--output',str(out),'--url','https://example.test/punto/'],check=True,capture_output=True)
 code=re.search(r'attivazione: ([a-f0-9]+)',(out/'ATTIVAZIONE-PRIVATA.txt').read_text())[1]
 with zipfile.ZipFile(out/'punto-hosting.zip') as z:
  assert '_private/.htaccess' in z.namelist() and '_private/storage/uploads/.htaccess' in z.namelist()
  assert not any('accesso.txt' in n or n.endswith('.sqlite') or '/.git/' in n for n in z.namelist())
  assert z.read('_private/.htaccess')==b'Require all denied\n'
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 env={**os.environ,'TRUST_HTTPS_PROXY':'false'}
 for key in ['DB_DSN','DB_USER','DB_PASSWORD','DB_TABLE_PREFIX']:env.pop(key,None)
 with open(folder/'server.log','w') as log:
  server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(out/'site')],env=env,stdout=log,stderr=log)
  try:
   url=f'http://127.0.0.1:{port}'
   opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
   for _ in range(50):
    try:r=opener.open(url+'/install.php');break
    except urllib.error.URLError:time.sleep(.1)
   html=r.read().decode();csrf=re.search(r'name="csrf" value="([a-f0-9]+)"',html)[1]
   form={'csrf':csrf,'token':'incorrect','name':'Installer test','email':'test@example.test','password':'Test-only-password-2026'}
   def post():return opener.open(url+'/install.php',urllib.parse.urlencode(form).encode())
   assert 'Codice non valido' in post().read().decode()
   with sqlite3.connect(db) as c:assert c.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]==1
   form['token']=code;r=post();assert r.url.endswith('/app.php')
   with sqlite3.connect(db) as c:
    assert c.execute('SELECT note FROM other_app').fetchone()[0]=='untouched'
    assert c.execute('SELECT email,role FROM punto_users').fetchone()==('test@example.test','admin')
   try:opener.open(url+'/install.php');raise AssertionError('Installer still accessible')
   except urllib.error.HTTPError as e:assert e.code==404
   state=json.load(opener.open(url+'/api.php?action=state'));assert state['demo'] is False
   request=urllib.request.Request(url+'/api.php?action=login',data=json.dumps({'email':form['email'],'password':form['password']}).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':state['csrf']})
   assert opener.open(request).code==200
   state=json.load(opener.open(url+'/api.php?action=state'));assert state['user']['role']=='admin'
  finally:server.terminate();server.wait(timeout=5)
print('Hosting bundle: isolated installation, bad token rejection, one-time lock and production login passed.')
