---
name: deploy-matriz
description: Deploy or restart the Matriz app on the production VM (movaci.com.br), and diagnose issues there, without breaking the pre-existing PDIAP site/MongoDB that shares the same machine. Use whenever the user asks to deploy, restart, check logs, or debug something "na VM" / "em produção" / "no servidor" for this project.
---

# Deploy da Matriz na VM de produção

Este skill documenta a topologia real da VM validada em sessão anterior — leia antes de agir, a VM hospeda **dois sites independentes** e um erro de escopo pode derrubar o PDIAP (que tem dados reais em MongoDB, sem relação com este projeto).

## Acesso

```
ssh -i ~/.ssh/matriz_vm root@147.93.191.79
```

A chave `~/.ssh/matriz_vm` (ed25519) já está autorizada — não pedir/usar senha em texto puro. Se a chave não existir na máquina atual, avise o usuário antes de tentar qualquer alternativa (nunca peça a senha por chat).

## Topologia (não mexer sem entender isto primeiro)

| Serviço | Path/porta pública | Porta interna | Gerenciado por |
|---|---|---|---|
| **Matriz** (este projeto) | `movaci.com.br/matriz` e `/matriz/*` | `localhost:3002` | PM2, processo `matriz`, cwd `/opt/matriz` |
| **PDIAP** (site pré-existente, não é deste projeto) | `movaci.com.br/` (raiz) | `localhost:3001` | PM2, processo separado |
| Reverse proxy + TLS | Caddy | — | `/etc/caddy/Caddyfile` |
| MySQL (Matriz) | — | container Docker `matriz-mysql-prod`, DB `matriz_prod` | Docker |
| MongoDB (PDIAP) | — | `127.0.0.1:27017/PDIAP` | nativo, fora de escopo deste projeto |

**Existe um terceiro processo Node na porta 3000** (usuário `geovane`, não gerenciado por PM2, não relacionado a este deploy) — **nunca tocar nele** (não fazer `kill`, não reaproveitar a porta). Se algo parecer travado na 3000, pare e pergunte antes de agir.

O `Caddyfile` (bloco `movaci.com.br, www.movaci.com.br`) usa um matcher `@matriz path /matriz /matriz/*` que aponta para `:3002`; todo o resto cai no `reverse_proxy localhost:3001` (PDIAP). Editar esse arquivo é uma ação de alto risco (pode derrubar os dois sites) — mostrar o diff e pedir confirmação antes de qualquer `caddy reload`.

## `.env` de produção (`/opt/matriz/.env`)

Contém `DATABASE_URL` (aponta para o MySQL do container acima), `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_BASE_PATH=/matriz`. Nunca imprimir esse arquivo inteiro no chat (contém segredos) — se precisar conferir uma variável específica, usar `grep -o '^NOME_DA_VAR=.*' .env | head -c 20` ou similar, nunca `cat .env` puro.

## Passos de deploy

1. **Antes de mexer em qualquer coisa**: `pm2 list` e `pm2 describe matriz` para confirmar o estado atual — não assumir que o processo já existe com esse nome exato se já faz tempo desde a última sessão.
2. **Levar o código novo para `/opt/matriz`**: confirme primeiro como o código chegou lá da última vez — `cd /opt/matriz && git status && git remote -v`. Se for um checkout git, `git pull` é o caminho. Se não for (cópia manual), transferir via `scp`/`rsync` a partir da máquina local, usando a mesma chave SSH — não presumir qual dos dois sem checar.
3. `npm install` (se `package.json`/`package-lock.json` mudou).
4. `npx prisma migrate deploy` (aplica migrations pendentes — **nunca** `prisma migrate dev` em produção, isso pode tentar recriar/resetar shadow database).
5. `npm run build`.
6. `pm2 restart matriz`.
7. **Sempre validar depois, nunca assumir sucesso**:
   ```
   pm2 logs matriz --lines 50 --nostream
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3002/matriz
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001   # confirma que o PDIAP não foi afetado
   ```

## Diagnóstico do MySQL de produção

```
docker exec matriz-mysql-prod mysql -u root -p<senha> matriz_prod -e "SELECT ..."
```
Só `SELECT`/`SHOW`/`EXPLAIN` sem confirmação prévia. Qualquer `DELETE`/`TRUNCATE`/`UPDATE`/`ALTER` em produção exige mostrar o comando exato e esperar confirmação explícita do usuário — mesmo que pareça óbvio, mesmo que já tenha sido autorizado antes nesta sessão (autorização não se estende automaticamente a comandos futuros).

## Erros já encontrados nesta VM (não repetir o diagnóstico do zero)

- **PDIAP "não acessa o banco"**: causa real era `configs/db-config.js` do PDIAP apontando para a base Mongo errada (`loginapp` em vez de `PDIAP`) — bug pré-existente, mascarado por meses por um processo órfão com conexão em memória antiga. Não é algo que o deploy da Matriz causa, mas reiniciar processos na VM pode expor esse tipo de bug antigo — se aparecer, é uma investigação separada, não assumir que foi o deploy que quebrou.
- **Imagens quebradas / login não funciona em `/matriz`**: causa era `basePath`/`next/image` sem loader customizado sob path não-raiz — já corrigido em `next.config.mjs`/`image-loader.js`. Se voltar a acontecer, conferir primeiro se `NEXT_PUBLIC_BASE_PATH` ainda está setado no `.env` da VM.
- **Upload de CSV trava/expira**: causa era um `DELETE` sem `FORCE INDEX` fazendo full table scan em `FatoIndicador` — já corrigido (`persistIngestionBatch.ts`). Se voltar a travar, comparar com `EXPLAIN` antes de assumir que é o mesmo bug.

## O que NUNCA fazer sem pedir confirmação primeiro

`pm2 delete`, `kill` em qualquer PID, `ufw`/firewall, `TRUNCATE`/`DROP`, editar o `Caddyfile`, reiniciar o processo do PDIAP, qualquer coisa na porta 3000. Mostrar o comando exato antes de rodar, mesmo que o usuário já tenha autorizado algo parecido antes nesta sessão.
