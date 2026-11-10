const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const env=path.join(root,'.env.local');
if(fs.existsSync(env)){console.error('.env.local already exists. Keep the existing admin credentials.');process.exit(1);}
const password=crypto.randomBytes(18).toString('base64url');
const hash=crypto.createHash('sha256').update(password).digest('hex');
const access=path.resolve(root,'..','ДОСТУП-АДМИН.txt');
if(fs.existsSync(access)){console.error('Access file already exists. New setup stopped.');process.exit(1);}
fs.writeFileSync(env,`ADMIN_PASSWORD_SHA256=${hash}\nPORT=4173\n`,{mode:0o600});
fs.writeFileSync(access,`SANY — доступ администратора\n\nЛокально: http://127.0.0.1:4173/#admin\nПубличный адрес: https://sany-machinery-kg.maroonagate2.chatgpt.site/#admin\nПароль: ${password}\n\nОткройте меню ☰ → Панель управления и введите пароль.\nВ разделе «Контакты» укажите телефон, email и адрес компании.\nЗаполните подтверждённые характеристики, цены и наличие.\nСохраните этот файл в надёжном месте и не публикуйте его.\n`,{mode:0o600});
console.log(`Admin configured. Credentials saved outside project: ${access}`);
