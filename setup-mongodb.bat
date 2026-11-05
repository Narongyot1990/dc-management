@echo off
echo ========================================
echo MongoDB Setup for Vercel
echo ========================================
echo.

set /p MONGODB_PASSWORD="Enter your MongoDB password: "

echo.
echo Your MongoDB URI will be:
echo mongodb+srv://narongyb_db_user:%MONGODB_PASSWORD%@fls-transport.jbzm6sk.mongodb.net/?appName=fls-transport
echo.

set "FULL_URI=mongodb+srv://narongyb_db_user:%MONGODB_PASSWORD%@fls-transport.jbzm6sk.mongodb.net/?appName=fls-transport"

echo Adding to Vercel...
echo.

REM Remove old MONGODB_URI
vercel env rm MONGODB_URI production

REM Add new MONGODB_URI
echo %FULL_URI% | vercel env add MONGODB_URI production

echo.
echo ========================================
echo Setup Complete!
echo Now deploying to Vercel...
echo ========================================
echo.

vercel --prod

echo.
echo Done! Check your app at:
echo https://dock-management-85ld1rok8-narongyot1990s-projects.vercel.app
