@echo off
REM Starts the Bookly MySQL server. Leave this window open while you work.
echo Starting MySQL for Bookly on port 3306...
"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --datadir="C:\Users\Echri\bookly-mysql\data" --port=3306 --console 