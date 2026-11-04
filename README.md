# Robô de Prospecção — Connect Digital

Especificação completa: [`PLANO_ROBO_PROSPECCAO.md`](PLANO_ROBO_PROSPECCAO.md).

Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres) · SerpApi · Vercel. **Sem login.**

## Colocar no ar (primeira vez)

1. **Banco (Supabase → SQL Editor → New query):** cole e rode, nesta ordem,
   `supabase/migrations/0001_schema.sql` e depois `supabase/migrations/0002_seed.sql`.
   Os dois podem ser rodados de novo sem estragar nada.
2. **Vercel:** importe o repositório `ConnecteDigital/Sistema-` no time `connect-digitals-projects`
   (Framework: Next.js, sem mudar nada no build).
3. **Variáveis de ambiente (Vercel → Settings → Environment Variables):** veja `.env.example`.
   Obrigatórias: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `KEYS_ENCRYPTION_SECRET`.
4. Faça um novo deploy, abra o endereço e vá em **Configurações** para cadastrar as chaves da SerpApi.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencher
npm run dev
```

O seed (`0002_seed.sql`) é gerado por `node scripts/gerar-seed.mjs` — edite o catálogo lá e gere de novo.

## Segurança

- RLS ligado em todas as tabelas e **sem políticas**: a chave pública do Supabase não lê nada.
  Só o servidor, com `SUPABASE_SECRET_KEY`, acessa o banco.
- Chaves da SerpApi ficam criptografadas (AES-256-GCM) com `KEYS_ENCRYPTION_SECRET`.
- Páginas com `noindex` e `robots.txt` bloqueando buscadores.
- `ACESSO_CODIGO` (opcional) liga um código pedido uma única vez por navegador.
