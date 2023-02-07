# KTHB Printing from Alma
Hanterar utskrifter från Alma (email)

## Funktioner
 NodeJS-tjänst för att hantera utskrifter från Alma

 Körs via PM2

 - PM2 start almaprint.js
 - PM2 save

 Ubuntu-server(lib.kth.se):
 
    - Installera:
        postfix
        cups
        cups-client
        samba
        smbclient
    - För puppeteer:
    https://techoverflow.net/2018/06/05/how-to-fix-puppetteer-error-while-loading-shared-libraries-libx11-xcb-so-1-cannot-open-shared-object-file-no-such-file-or-directory/

        sudo apt-get install libgbm-dev gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget


    - Skrivare
        Huvudbiblioteket kontor plan3 = "\\PRINT05\KTHB_DOK_AF_MPC2550"
        Huvudbiblioteket backoffice = "\\PRINT05\ECE_KTHB_BACKOFFICE"
        sudo lpadmin -p alma-hb -v smb://user:password@ug.kth.se/print05.ug.kth.se/ECE_KTHB_BACKOFFICE -E
        Kista = "\\print06\ICT-Bibliotek"
        sudo lpadmin -p alma-kista -v smb://user:password@ug.kth.se/print06.ug.kth.se/ICT-Bibliotek -E
        Telge = "192.168.71.103"
        sudo lpadmin -p alma-telge -v socket://192.168.71.103:9100/ -E
        (sudo lpadmin -p alma-telge -v ipp://192.168.71.103/ipp/print -E -m everywhere)
        Ta bort:
        sudo lpadmin -x skrivare
        Lista:
        lpstat -t
        Enable:
        cupsenable skrivare


    - Postfix:
        https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-postfix-on-ubuntu-18-04


### Environment Variables

.env

```sh
ENVIRONMENT=development (development, production etc)
OS=linux (operativsystem: linux, windows etc)
APPDIR=/folder/folder/ (sökväg till tjänsten)
PRINTDIR=almaprint/ (sökväg till utskriftsmapp)
PRINTHISTORYDIR=almaprint/history/ (sökväg till historik)
PRINTFORMAT=A5 (utskriftsformat: A4, A5 etc)
PRINTFORMAT_INVOICE=A4
PRINTFORMAT_TELGE=A5
PRINTMARGINTOP=1.00cm (utskriftsmarginal)
PRINTMARGINRIGHT=1.00cm (utskriftsmarginal)
PRINTMARGINBOTTOM=1.00cm (utskriftsmarginal)
PRINTMARGINLEFT=1.00cm (utskriftsmarginal)
MAILDIR=Maildir/new/ (sökväg till mail)
HBPRINTER=xxxxxx (namn på skrivare)
KISTAPRINTER=xxxxxx (namn på skrivare)
TELGEPRINTER=xxxxxx (namn på skrivare)
HBEMAIL=xxxxxx@xxx.lib.kth.se
KISTAEMAIL=xxxxxx@xxx.lib.kth.se
TELGEEMAIL=xxxxxx@xxx.lib.kth.se
SMTP_HOST=localhost (smtp-server)
MAILFROM_NAME=Xxxxxx Xxxxxx (avsändarnamn)
MAILFROM_ADDRESS=noreply@xxx.lib.kth.se (avsändaremail)
MAILFROM_SUBJECT=Alma Printing (ämne för mail)
MAILTO_ADDRESS=xxxxxxxx@kth.se (email adress till support/admin)
```

### Bla bla bla

#### Bla bla bla