// Gera supabase/migrations/0002_seed.sql a partir do catálogo abaixo (apêndice A + seção 6).
// Uso: node scripts/gerar-seed.mjs
import { writeFileSync } from "node:fs";

const SP = ",State of Sao Paulo,Brazil";
const PR = ",State of Parana,Brazil";
const SC = ",State of Santa Catarina,Brazil";
const DF = ",Federal District,Brazil";
const GO = ",State of Goias,Brazil";
const MT = ",State of Mato Grosso,Brazil";

// [nome, canonical, tipo, camada, validado]  — validado = já testado na SerpApi (apêndice A)
const regioes = [
  { nome: "011 Capital", uf: "SP", ddd: "11", descricao: "São Paulo capital por zonas/distritos", pontos: [
    ["Consolação (Centro)", "Consolacao" + SP, "District", "minima", 1],
    ["Tatuapé (Leste)", "Tatuape" + SP, "District", "minima", 1],
    ["Santana (Norte)", "Santana" + SP, "District", "minima", 1],
    ["Lapa (Oeste)", "Lapa" + SP, "District", "minima", 1],
    ["Santo Amaro (Sul)", "Santo Amaro" + SP, "District", "minima", 1],
    ["Mooca", "Mooca" + SP, "District", "media", 1],
    ["Penha", "Penha" + SP, "District", "media", 1],
    ["Itaquera", "Itaquera" + SP, "District", "media", 1],
    ["São Miguel Paulista", "Sao Miguel Paulista" + SP, "District", "media", 1],
    ["Tucuruvi", "Tucuruvi" + SP, "District", "media", 1],
    ["Freguesia do Ó", "Freguesia do O" + SP, "District", "media", 1],
    ["Butantã", "Butanta" + SP, "District", "media", 1],
    ["Vila Mariana", "Vila Mariana" + SP, "District", "media", 1],
    ["Ipiranga", "Ipiranga" + SP, "District", "media", 1],
    ["Jabaquara", "Jabaquara" + SP, "District", "media", 1],
    ["Campo Limpo", "Campo Limpo" + SP, "District", "media", 1],
    ["Bom Retiro", "Bom Retiro" + SP, "District", "ampla", 1],
    ["Guaianases", "Guaianases" + SP, "District", "ampla", 1],
    ["Vila Maria", "Vila Maria" + SP, "District", "ampla", 1],
    ["Pinheiros", "Pinheiros" + SP, "District", "ampla", 1],
    ["Capão Redondo", "Capao Redondo" + SP, "District", "ampla", 1],
  ]},
  { nome: "011 ABC", uf: "SP", ddd: "11", descricao: "Grande ABC", pontos: [
    ["Santo André", "Santo Andre" + SP, "City", "minima", 1],
    ["São Bernardo do Campo", "Sao Bernardo do Campo" + SP, "City", "minima", 1],
    ["São Caetano do Sul", "Sao Caetano do Sul" + SP, "City", "media", 1],
    ["Diadema", "Diadema" + SP, "City", "media", 1],
    ["Mauá", "Maua" + SP, "City", "media", 1],
    ["Ribeirão Pires", "Ribeirao Pires" + SP, "City", "ampla", 1],
    ["Rio Grande da Serra", "Rio Grande da Serra" + SP, "City", "ampla", 1],
  ]},
  { nome: "011 Grande SP", uf: "SP", ddd: "11", descricao: "Guarulhos, Osasco e região", pontos: [
    ["Guarulhos", "Guarulhos" + SP, "City", "minima", 1],
    ["Osasco", "Osasco,Osasco" + SP, "City", "minima", 1],
    ["Barueri", "Barueri" + SP, "City", "media", 0],
    ["Carapicuíba", "Carapicuiba" + SP, "City", "media", 0],
    ["Mogi das Cruzes", "Mogi das Cruzes" + SP, "City", "media", 0],
    ["Taboão da Serra", "Taboao da Serra" + SP, "City", "ampla", 0],
    ["Cotia", "Cotia" + SP, "City", "ampla", 0],
  ]},
  { nome: "012 São José dos Campos", uf: "SP", ddd: "12", descricao: "Vale do Paraíba", pontos: [
    ["São José dos Campos", "Sao Jose dos Campos" + SP, "City", "minima", 1],
    ["Taubaté", "Taubate" + SP, "City", "media", 0],
    ["Jacareí", "Jacarei" + SP, "City", "media", 0],
  ]},
  { nome: "013 Baixada Santista", uf: "SP", ddd: "13", descricao: "Litoral de SP", pontos: [
    ["Santos", "Santos" + SP, "City", "minima", 0],
    ["São Vicente", "Sao Vicente" + SP, "City", "minima", 0],
    ["Praia Grande", "Praia Grande" + SP, "City", "media", 0],
    ["Guarujá", "Guaruja" + SP, "City", "media", 0],
    ["Cubatão", "Cubatao" + SP, "City", "ampla", 0],
    ["Itanhaém", "Itanhaem" + SP, "City", "ampla", 0],
    ["Mongaguá", "Mongagua" + SP, "City", "ampla", 0],
    ["Bertioga", "Bertioga" + SP, "City", "ampla", 0],
  ]},
  { nome: "019 Campinas e região", uf: "SP", ddd: "19", descricao: "Cidades grandes do 019", pontos: [
    ["Campinas", "Campinas" + SP, "City", "minima", 1],
    ["Piracicaba", "Piracicaba" + SP, "City", "minima", 0],
    ["Sumaré", "Sumare" + SP, "City", "media", 0],
    ["Americana", "Americana" + SP, "City", "media", 0],
    ["Limeira", "Limeira" + SP, "City", "media", 0],
    ["Indaiatuba", "Indaiatuba" + SP, "City", "media", 0],
    ["Hortolândia", "Hortolandia" + SP, "City", "ampla", 0],
    ["Valinhos", "Valinhos" + SP, "City", "ampla", 0],
    ["Rio Claro", "Rio Claro" + SP, "City", "ampla", 0],
    ["Santa Bárbara d'Oeste", "Santa Barbara d'Oeste" + SP, "City", "ampla", 0],
  ]},
  { nome: "016 Ribeirão Preto e região", uf: "SP", ddd: "16", descricao: "Cidades grandes do 016", pontos: [
    ["Ribeirão Preto", "Ribeirao Preto" + SP, "City", "minima", 0],
    ["Araraquara", "Araraquara" + SP, "City", "media", 0],
    ["São Carlos", "Sao Carlos" + SP, "City", "media", 0],
    ["Franca", "Franca" + SP, "City", "media", 0],
    ["Sertãozinho", "Sertaozinho" + SP, "City", "ampla", 0],
  ]},
  { nome: "041 Curitiba e região", uf: "PR", ddd: "41", descricao: "Curitiba e região metropolitana", pontos: [
    ["Curitiba", "Curitiba" + PR, "City", "minima", 1],
    ["São José dos Pinhais", "Sao Jose dos Pinhais" + PR, "City", "media", 1],
    ["Colombo", "Colombo" + PR, "City", "media", 1],
    ["Araucária", "Araucaria" + PR, "City", "ampla", 1],
    ["Pinhais", "Pinhais" + PR, "City", "ampla", 1],
    ["Almirante Tamandaré", "Almirante Tamandare" + PR, "City", "ampla", 1],
  ]},
  { nome: "048 Florianópolis e região", uf: "SC", ddd: "48", descricao: "Grande Florianópolis", pontos: [
    ["Florianópolis", "Florianopolis" + SC, "City", "minima", 1],
    ["São José", "Sao Jose" + SC, "City", "media", 1],
    ["Palhoça", "Palhoca" + SC, "City", "ampla", 1],
    ["Biguaçu", "Biguacu" + SC, "City", "ampla", 1],
  ]},
  { nome: "047 Balneário Camboriú e região", uf: "SC", ddd: "47", descricao: "Litoral norte de SC", pontos: [
    ["Balneário Camboriú", "Balneario Camboriu" + SC, "City", "minima", 1],
    ["Itajaí", "Itajai" + SC, "City", "media", 1],
    ["Camboriú", "Camboriu" + SC, "City", "ampla", 1],
    ["Itapema", "Itapema" + SC, "City", "ampla", 1],
  ]},
  { nome: "061 Distrito Federal", uf: "DF", ddd: "61", descricao: "Brasília e regiões administrativas", pontos: [
    ["Brasília", "Brasilia" + DF, "City", "minima", 1],
    ["Taguatinga", "Taguatinga, Federal District" + DF, "District", "minima", 1],
    ["Águas Claras", "Aguas Claras, Federal District" + DF, "District", "media", 1],
    ["Samambaia", "Samambaia" + DF, "District", "media", 1],
    ["Asa Sul", "Asa Sul" + DF, "District", "media", 1],
    ["Sobradinho", "Sobradinho" + DF, "District", "ampla", 1],
    ["Planaltina", "Planaltina" + DF, "District", "ampla", 1],
    ["Santa Maria", "Santa Maria" + DF, "District", "ampla", 1],
  ]},
  { nome: "062 Goiânia e região", uf: "GO", ddd: "62", descricao: "Grande Goiânia", pontos: [
    ["Goiânia", "Goiania" + GO, "City", "minima", 1],
    ["Aparecida de Goiânia", "Aparecida de Goiania" + GO, "City", "media", 1],
    ["Senador Canedo", "Senador Canedo" + GO, "City", "ampla", 1],
    ["Trindade", "Trindade" + GO, "City", "ampla", 1],
  ]},
  { nome: "065 Cuiabá e região", uf: "MT", ddd: "65", descricao: "Cuiabá e Várzea Grande", pontos: [
    ["Cuiabá", "Cuiaba" + MT, "City", "minima", 1],
    ["Várzea Grande", "Varzea Grande" + MT, "City", "media", 1],
  ]},
];

const nichos = [
  ["Desentupidora", ["{termo}", "{termo} 24 horas", "{termo} perto de mim", "{termo} mais próxima", "desentupimento", "desentupir esgoto", "desentupidora de vaso"]],
  ["Encanador", ["{termo}", "{termo} 24 horas", "{termo} perto de mim", "{termo} mais próximo", "{termo} emergência", "serviços hidráulicos", "caça vazamento"]],
  ["Eletricista", ["{termo}", "{termo} 24 horas", "{termo} perto de mim", "{termo} residencial", "{termo} emergência"]],
  ["Serralheiro", ["{termo}", "serralheria", "serralheria perto de mim", "{termo} 24 horas"]],
  ["Caça vazamento", ["{termo}", "caça vazamento 24 horas", "detecção de vazamento", "vazamento de água"]],
  ["Limpa fossa", ["{termo}", "limpa fossa 24 horas", "limpeza de fossa", "caminhão limpa fossa"]],
];

const blocklist = [
  ["getninjas.com.br", "Marketplace de serviços"],
  ["portoseguro.com.br", "Seguradora"],
  ["habitissimo.com.br", "Marketplace de serviços"],
  ["mercadolivre.com.br", "Marketplace"],
  ["olx.com.br", "Classificados"],
  ["google.com", "Google"],
];

const settings = {
  forca_limites: { fraca_ate: 0.40, forte_acima: 0.75 },
  troca_chave_limite: 2,
  buscas_em_paralelo: 6,
  reverificar_site_dias: 7,
};

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
let sql = `-- Robô de Prospecção — dados iniciais (apêndice A, seção 6, seção 10).
-- GERADO por scripts/gerar-seed.mjs. Rodar DEPOIS do 0001_schema.sql. Pode rodar de novo.
-- Pontos com validado_em = null ainda não foram conferidos na SerpApi:
-- use o botão "Validar locais" em Configurações (grátis).

`;
regioes.forEach((r, i) => {
  sql += `insert into regions (nome, uf, ddd, descricao, ordem) values (${q(r.nome)}, ${q(r.uf)}, ${q(r.ddd)}, ${q(r.descricao)}, ${i})
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;\n`;
  const valores = r.pontos.map(([n, c, t, cam, v]) =>
    `  (${q(n)}, ${q(c)}, ${q(t)}, ${q(cam)}, ${q(r.ddd)}, ${v ? "now()" : "null::timestamptz"})`).join(",\n");
  sql += `insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
${valores}
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = ${q(r.nome)}
on conflict (region_id, serpapi_canonical) do nothing;\n\n`;
});
nichos.forEach(([nome, modelos], i) => {
  sql += `insert into niches (nome, ordem) values (${q(nome)}, ${i}) on conflict (nome) do nothing;\n`;
  sql += `insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
${modelos.map((m, j) => `  (${q(m)}, ${j})`).join(",\n")}
) as v(modelo, ordem) where n.nome = ${q(nome)}
on conflict (niche_id, modelo) do nothing;\n\n`;
});
sql += `insert into blocklist (dominio, motivo) values\n${blocklist.map(([d, m]) => `  (${q(d)}, ${q(m)})`).join(",\n")}\non conflict (dominio) do nothing;\n\n`;
for (const [k, v] of Object.entries(settings)) {
  sql += `insert into settings (chave, valor) values (${q(k)}, ${q(JSON.stringify(v))}::jsonb) on conflict (chave) do nothing;\n`;
}
sql += `\ninsert into equipe (nome) values ('Gabriel') on conflict (nome) do nothing;\n`;

writeFileSync(new URL("../supabase/migrations/0002_seed.sql", import.meta.url), sql);
console.log("ok:", regioes.reduce((a, r) => a + r.pontos.length, 0), "pontos");
