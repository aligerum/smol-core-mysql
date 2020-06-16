create database $database;
create user '$user'@'localhost' identified by '$password';
grant all privileges on $database.* to '$user'@'localhost';
