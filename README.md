# KTHB Printing from Alma
Hanterar utskrifter från Alma (email)

## Funktioner
 NodeJS-tjänst för att hantera utskrifter från Alma

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
        sudo lpadmin -p alma-telge -v ipp://192.168.71.103/ipp/print -E -m everywhere
        Ta bort:
        sudo lpadmin -x skrivare


    - Postfix:
        https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-postfix-on-ubuntu-18-04


### Används för xxxx

### Bla bla bla

#### Bla bla bla