#!/usr/bin/env python3
"""Build a runtime-only Apache shared-hosting bundle. Never reads the local database/config.
The output is private: it includes the hosting configuration and a one-time activation code.
"""
import argparse, hashlib, pathlib, re, secrets, shutil, time, urllib.parse, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser()
p.add_argument('--output',required=True)
p.add_argument('--config',required=True,help='Private PHP hosting config prepared separately')
p.add_argument('--url',required=True,help='Canonical HTTPS URL, e.g. https://account.altervista.org/punto/')
p.add_argument('--altervista',action='store_true')
a=p.parse_args();url=urllib.parse.urlparse(a.url)
if url.scheme!='https' or not url.hostname or url.query or url.fragment or url.username or not re.fullmatch(r'/[a-zA-Z0-9/_-]*/',url.path):
 p.error('Use a canonical HTTPS URL with a trailing slash and a simple path.')
folder=pathlib.Path(a.output).resolve();folder.mkdir(mode=0o700,parents=True,exist_ok=False)
site=folder/'site';shutil.copytree(ROOT/'public',site)
private=site/'_private';private.mkdir()
for name in ['app','database']:shutil.copytree(ROOT/name,private/name)
(private/'storage/uploads').mkdir(parents=True)
(private/'storage/uploads/.htaccess').write_text('Require all denied\n')
(private/'.htaccess').write_text('Require all denied\n')
schema=(private/'database/schema.sql').read_text()
(private/'database/schema.php').write_text("<?php return <<<'PUNTO_SCHEMA'\n"+schema+"\nPUNTO_SCHEMA;\n")
(private/'database/schema.sql').unlink()
bootstrap=private/'app/bootstrap.php'
bootstrap.write_text(bootstrap.read_text().replace("file_get_contents(ROOT . '/database/schema.sql')","(require ROOT . '/database/schema.php')"))
notice=site/'assets/vendor/GSAP-NOTICE.md'
if notice.exists():notice.rename(notice.with_suffix('.txt'))
(private/'storage/protection.txt').write_text('Private storage must not be served.\n')
for name in ['index.php','app.php','api.php']:
 path=site/name;path.write_text(path.read_text().replace("__DIR__ . '/../app/", "__DIR__ . '/_private/app/"))
config=pathlib.Path(a.config).resolve()
shutil.copy2(config,private/'hosting.php')
token=secrets.token_hex(24)
(private/'config.php').write_text("<?php\nreturn array_replace(require __DIR__ . '/hosting.php', "+
 "['APP_ENV'=>'production','TRUST_HTTPS_PROXY'=>true,'INSTALL_TOKEN_HASH'=>'"+hashlib.sha256(token.encode()).hexdigest()+
 "','INSTALL_EXPIRES'=>"+str(int(time.time())+86400)+"]);\n")
shutil.copy2(ROOT/'deploy/install.php',site/'install.php')
ht=(site/'.htaccess').read_text()
ht+='\nRewriteEngine On\nRewriteCond %{HTTPS} !=on\nRewriteCond %{HTTP:X-Forwarded-Proto} !^https$ [NC]\nRewriteRule ^(.*)$ '+a.url+'$1 [R=302,L]\n'
# Defense in depth: the private directory is denied both here and in its own .htaccess.
ht+='RewriteRule ^_private(?:/|$) - [F,L,NC]\n'
if a.altervista:ht+='\nAddHandler av-php84 .php\n'
(site/'.htaccess').write_text(ht)
with zipfile.ZipFile(folder/'punto-hosting.zip','w',zipfile.ZIP_DEFLATED) as z:
 for path in sorted(site.rglob('*')):
  if path.is_file():z.write(path,path.relative_to(site).as_posix())
activation=folder/'ATTIVAZIONE-PRIVATA.txt'
activation.write_text('Punto — accesso personale\n\nPagina: '+a.url+'install.php\nCodice di attivazione: '+token+'\n\nScegli sul sito email e password del workspace.\nNon caricare questo file su hosting o GitHub. Il codice scade dopo 24 ore.\n')
activation.chmod(0o600)
print('Bundle pronto:',folder/'punto-hosting.zip')
print('Istruzioni private:',activation)
