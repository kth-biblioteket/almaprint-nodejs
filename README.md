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