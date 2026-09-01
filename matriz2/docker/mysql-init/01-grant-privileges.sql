-- Concede privilégio de criação de bancos ao usuário de aplicação, necessário
-- para o "shadow database" que o Prisma Migrate usa em desenvolvimento local.
GRANT ALL PRIVILEGES ON *.* TO 'matriz_user'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
