# Thê-lie Cerâmico

Site em HTML/CSS/JavaScript com painel em PHP e MySQL para a hospedagem Hostinger.

## Publicação

A publicação na Hostinger usa o repositório Git no diretório `public_html`. Aponte o deploy para a branch `alteracao/telefone` ou `main` (ambas recebem as mesmas alterações). O site precisa de PHP 8.1+ com `pdo_mysql`, `mbstring` e `fileinfo`; o Live Server do VS Code e hospedagens apenas estáticas não executam a API.

Após a primeira publicação, abra `https://thelieceramico.com.br/api/setup.php` em uma conexão HTTPS. Informe ali, diretamente no site, a senha do usuário MySQL `u901531260_thelie`. O formulário testa a conexão, cria as tabelas, salva a configuração fora de `public_html` quando possível e cadastra as nove peças e os usuários `tereza` e `luiz`. A senha do banco não entra no GitHub. A página de configuração se desativa após concluir.

O cadeado no menu abre o login em um modal. Depois de autenticar, o painel de peças abre em uma nova aba. O primeiro acesso direciona para `Minha conta`, onde cada usuário troca a senha temporária. Essa página também permite editar nome, e-mail e telefone. Galeria e Destaques podem ser editados no painel; fotos devem ser JPG de até 5 MB e são armazenadas no MySQL. Peso e medidas começam em branco para evitar dados inventados; o prazo inicial é de 30 dias.

## Desenvolvimento

Para executar tudo localmente, use PHP com um servidor MySQL e defina `THELIE_DB_HOST`, `THELIE_DB_PORT`, `THELIE_DB_NAME`, `THELIE_DB_USER` e `THELIE_DB_PASSWORD`. Execute `php -S 127.0.0.1:8000` na raiz do projeto. `npm run build` gera apenas a visualização estática em `dist/`; o painel requer o deploy PHP dos arquivos da raiz.
