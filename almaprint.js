/**
 * 
 * NodeJS-tjänst för att hantera utskrifter från Alma
 * 
 * Skrivare som måste sättas upp i Ubuntu:
 *
 * HBkontorskrivare = "\\PRINT05\KTHB_DOK_AF_MPC2550"
 * Huvudbiblioteketbackofficeskrivare = "\\PRINT05\ECE_KTHB_BACKOFFICE"
 * sudo lpadmin -p alma-hb -v smb://user:password@ug.kth.se/print05.ug.kth.se/ECE_KTHB_BACKOFFICE
 * Kistaskrivare = "\\print06\ICT-Bibliotek"
 * sudo lpadmin -p alma-kista -v smb://user:password@ug.kth.se/print06.ug.kth.se/ICT-Bibliotek
 * Telgeskrivare = ?? Har det satts upp någon ännu???
 * sudo lpadmin -p alma-telge -v smb://user:password@ug.kth.se/xxxxxx.ug.kth.se/XXXXXXXXXXXXX
 * Kvittoskrivare = ?? Används inte...
 * 
 * 
 * TODO
 * Felhantering 
 */
require('dotenv').config()
const fs = require('fs');
const simpleParser = require('mailparser').simpleParser;
const puppeteer = require('puppeteer')
const chokidar = require('chokidar');
const printer = require ("node-printer-lp-complete");
const winston = require('winston');
const timezoned = () => {
    var options = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        timeZone: 'Europe/Stockholm'
    };
    return new Date().toLocaleString('sv-SE', options);
};
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: timezoned
          }),
        winston.format.json()
    ),
    defaultMeta: { service: 'user-service' },
    transports: [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' })
    ]
});
const appdir = process.env.APPDIR;
const maildir = process.env.MAILDIR;
const printdir = process.env.PRINTDIR;
const printhistorydir = process.env.PRINTHISTORYDIR;
var printformat = process.env.PRINTFORMAT;
var printername;
const watcher = chokidar.watch(".", {
    cwd: appdir + maildir,
    ignored: /node_modules|\.git|\.DS_Store/,
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
    },
});

logger.log('info',"almaprintserver started");

watcher
.on('error', error => logger.log('error',`Watcher error: ${error}`))

.on('add', async path => {
    logger.log('info',`File ${appdir + maildir + path} has been added`);

    try {
        let source = fs.createReadStream(appdir + maildir + path);

        source.on('error', function(error) {
            logger.log('error',`open file error: ${error}`)
        });

        source.on('open', async function () {
            let parsed = await simpleParser(source);
            switch (parsed.to.text) {
                case process.env.HBEMAIL:
                    printername = process.env.HBPRINTER;
                case process.env.KISTAEMAIL:
                    printername = process.env.KISTAPRINTER;
                case process.env.TELGEEMAIL:
                    printername = process.env.TELGEPRINTER;
                default:
                    printername = process.env.HBPRINTER;
            }

            //Se till att låntagarens barcode kommer med på fakturautskriften
            if(parsed.subject == "Lost Items Bill" || parsed.subject == "Lost Item Bill" || parsed.subject == "Räkning för borttappat material") {
                parsed.html = parsed.html.replace("</style>",`@font-face
                        {
                            font-family: Code39AzaleaFont;
                            src: url('${appdir + printdir}fonts/Code39Azalea.ttf') format('truetype');
                            font-weight: normal;
                            font-style: normal;
                        }
                        .patronbarcode, .itembarcode, #itembarcode {
                            display:block !important;
                            font-family:Code39AzaleaFont; 
                            font-size:40px;
                            visibility: visible !important;
                        }
                        .patronbarcodenumbers{
                            display:block !important;
                        }
                    </style>`);
                printformat = "A4";
            }
            if(parsed.subject == "Resource Request" 
            || parsed.subject == "Transit" 
            || parsed.subject == "Cash Receipt" 
            || parsed.subject == "Kvitto") {
                printformat = "A5";
                if(parsed.to.text == process.env.TELGEEMAIL) {
                    printformat = "A4" //Telge har bara ett fack i sin skrivare för närvarande.
                }
            }
            //Skapa pdf från HTML(email)
            fs.writeFile(appdir + printdir + path + '.html', parsed.html, function(error){ 
                if (error) logger.log('error',`Watcher error: ${error}`) 
            });
            
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            
            page.on('error', error=> {
                logger.log('error',`chromium browser error at page: ${error}`)
            });
            
            page.on('pageerror', error=> {
                logger.log('error',`chromium pageerror: ${error}`)
            })
            
            await page.goto('file://' + appdir + printdir + path + '.html');
            
            await page.pdf({ format: printformat, path: appdir + printdir + path + '.pdf' });
            
            await browser.close();

             //Skriv ut
             var printoptions = {
                //media: 'a5',
                destination: printername,
                n: 1,
                fitplot: true
            };

            fs.copyFile(appdir +  printdir + path + '.pdf', appdir + printhistorydir +  path + '_'+ Date.now() +'.pdf', (error) => {
                if (error) { 
                    logger.log('error',`copyfile error: ${error}`);
                } else {
                    logger.log('info','pdf copied to history');
                    var file = appdir +  printdir + path + '.pdf';
                    var jobFile = printer.printFile(file, printoptions, "alma_print");

                    var onJobEnd = function () {
                        logger.log('info', this.identifier + ", job sent to printer queue");
                        //ta bort filer
                        fs.unlink(appdir + maildir + path,function (error) {
                            if (error) logger.log('error',`unlink error: ${error}`);
                            logger.log('info','File ' + appdir + maildir + path + ' removed successfully.');
                        });
                        fs.unlink(appdir + printdir + path + '.pdf',function (error) {
                            if (error) logger.log('error',`unlink error: ${error}`);
                            logger.log('info','File ' + appdir + printdir + path + '.pdf' + ' removed successfully.');
                        });
                        fs.unlink(appdir + printdir + path + '.html',function (error) {
                            if (error) logger.log('error',`unlink error: ${error}`);
                            logger.log('info','File ' + appdir + printdir + path + '.html' + ' removed successfully.');
                        });
                    };
                    var onJobError = function (message) {
                        logger.log('error', this.identifier + ", error: " + message);
                    };
        
                    jobFile.on("end", onJobEnd);
                    jobFile.on("error", onJobError);
                }
            });
        });
    } catch(e) {
        logger.log('error', `${e}`);
    }
})
.on('remove', async path => {logger.log('info','File ' + path + ' removed.');});
