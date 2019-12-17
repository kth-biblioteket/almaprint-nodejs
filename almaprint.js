/*
 * 
 */
require('dotenv').config()
const fs = require('fs');
const simpleParser = require('mailparser').simpleParser;
const puppeteer = require('puppeteer')
const chokidar = require('chokidar');
const printer = require ("node-printer-lp-complete");
const winston = require('winston');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    port: 25,
    host: 'localhost',
    tls: {
      rejectUnauthorized: false
    },
});
var outgoing_mail_message = {
    from: process.env.OUTGOINGEMAILFROM,
    to: process.env.OUTGOINGEMAILTO,
    subject: 'Alma Printing',
    text: '',
    html: ''
};
var send_error_mail = false;

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
var printmargin = { 
    top: process.env.PRINTMARGINTOP, 
    right: process.env.PRINTMARGINRIGHT, 
    bottom: process.env.PRINTMARGINBOTTOM, 
    left: process.env.PRINTMARGINLEFT
};
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
var incomingmailcontent = "";

function sendemail(message) {
    transporter.sendMail(message, (error, info) => {
        if (error) {
            return logger.log('error',error);
        }
        logger.log('info',`Email message sent to: ${message.to}, ${info.messageId}`);
    });
}

logger.log('info',"Alma Print service started");
outgoing_mail_message.text = `Alma Print service started`;
outgoing_mail_message.html = `<p>Alma Print service started</p>`;
sendemail(outgoing_mail_message);

watcher
.on('error', error => logger.log('error',`Watcher error: ${error}`))

//Process som startas varje gång ett mail mottagits(fil adderats i mailfolder)
.on('add', async path => {
    outgoing_mail_message.text = ``;
    outgoing_mail_message.html = ``;
    logger.log('info',`File ${appdir + maildir + path} has been added`);
    let source = fs.createReadStream(appdir + maildir + path);

    source.on('error', function(error) {
        logger.log('error',`open mail file error: ${error}`)
        outgoing_mail_message.text = `open mail file error: ${error}`;
        outgoing_mail_message.html = `<p>open mail file error: ${error}</p>`;
    });

    source.on('open', async function () {
        try {
            let parsed = await simpleParser(source);
            //Definiera skrivare beroende på avsändare
            if(typeof parsed.to !== 'undefined') {
                switch (parsed.to.text) {
                    case process.env.HBEMAIL:
                        printername = process.env.HBPRINTER;
                        break;
                    case process.env.KISTAEMAIL:
                        printername = process.env.KISTAPRINTER;
                        break;
                    case process.env.TELGEEMAIL:
                        printername = process.env.TELGEPRINTER;
                        break;
                    default:
                        printername = process.env.HBPRINTER;
                        break;
                }
            } else {
                printername = process.env.HBPRINTER;
            }

            //Se till att låntagarens barcode kommer med på fakturautskriften
            if(parsed.subject == "Lost Items Bill" || parsed.subject == "Lost Item Bill" || parsed.subject == "Räkning för borttappat material") {
                parsed.html = parsed.html.replace("</head>",`<style>@font-face
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
                    </style>
                </head>`);
                printformat = "A4";
            }
            //Definiera pappersstorlek beroende på typ av letter
            if(parsed.subject == "Resource Request" 
            || parsed.subject == "Transit" 
            || parsed.subject == "Cash Receipt" 
            || parsed.subject == "Kvitto") {
                printformat = "A5";
                if(parsed.to.text == process.env.TELGEEMAIL) {
                    printformat = "A4" //Telge har bara ett fack i sin skrivare för närvarande.
                }
            }

            //Skapa html-fil från mailet
            if(parsed.html) {
                incomingmailcontent = parsed.html;
            } else {
                incomingmailcontent = parsed.text
            }
            fs.writeFile(appdir + printdir + path + '.html', incomingmailcontent, function(error){ 
                if (error) {
                    logger.log('error',`Watcher error: ${error}`)
                    outgoing_mail_message.text = `Watcher error: ${error}`;
                    outgoing_mail_message.html = `<p>Watcher error: ${error}</p>`;
                }
            });
        
            //Öppna html-filen i chromium
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            
            page.on('error', error=> {
                logger.log('error',`chromium browser error at page: ${error}`)
                outgoing_mail_message.text = `chromium browser error at page: ${error}`;
                outgoing_mail_message.html = `<p>chromium browser error at page: ${error}</p>`;
            });
            
            page.on('pageerror', error=> {
                logger.log('error',`chromium pageerror: ${error}`)
                outgoing_mail_message.text = `chromium pageerror: ${error}`;
                outgoing_mail_message.html = `<p>chromium pageerror: ${error}</p>`;
            })
            
            await page.goto('file://' + appdir + printdir + path + '.html');
            //Skapa pdf-fil
            await page.pdf({ format: printformat, path: appdir + printdir + path + '.pdf', margin: printmargin });
            
            await browser.close();

            //Skriv ut pdf-fil
            var printoptions = {
                //media: 'a5',
                destination: printername,
                n: 1,
                fitplot: true
            };

            var file = appdir +  printdir + path + '.pdf';
            var jobFile = printer.printFile(file, printoptions, "alma_print");

            var onJobEnd = function () {
                logger.log('info',`Printed file ${file} successfully`);
                //Kopiera och ta bort filer
                fs.copyFile(appdir +  printdir + path + '.pdf', appdir + printhistorydir +  path + '_'+ Date.now() +'.pdf', (error) => {
                    if (error) { 
                        logger.log('error',`copyfile pdf error: ${error}`);
                        outgoing_mail_message.text = `copyfile pdf error: ${error}`;
                        outgoing_mail_message.html = `<p>copyfile pdf error: ${error}</p>`;
                    } else {
                        logger.log('info', appdir +  printdir + path + '.pdf copied to' + appdir + printhistorydir +  path);

                        fs.unlink(appdir + maildir + path,function (error) {
                            if (error) {
                                logger.log('error',`unlink error: ${error}`);
                                outgoing_mail_message.text = `unlink error: ${error}`;
                                outgoing_mail_message.html = `<p>unlink error: ${error}</p>`;
                            }
                            logger.log('info','File ' + appdir + maildir + path + ' removed successfully.');
                        });
                        fs.unlink(appdir + printdir + path + '.pdf',function (error) {
                            if (error) {
                                logger.log('error',`unlink pdf error: ${error}`);
                                outgoing_mail_message.text = `unlink pdf error: ${error}`;
                                outgoing_mail_message.html = `<p>unlink pdf error: ${error}</p>`;
                            }
                            logger.log('info','File ' + appdir + printdir + path + '.pdf' + ' removed successfully.');
                        });
                    }
                });
                fs.copyFile(appdir +  printdir + path + '.html', appdir + printhistorydir +  path + '_'+ Date.now() +'.html', (error) => {
                    if (error) { 
                        logger.log('error',`copyfile error: ${error}`);
                        outgoing_mail_message.text = `copyfile html error: ${error}`;
                        outgoing_mail_message.html = `<p>copyfile html error: ${error}</p>`;
                    } else {
                        logger.log('info', appdir +  printdir + path + '.html copied to' + appdir + printhistorydir +  path);

                        fs.unlink(appdir + printdir + path + '.html',function (error) {
                            if (error) {
                                logger.log('error',`unlink error: ${error}`);
                                outgoing_mail_message.text = `unlink html error: ${error}`;
                                outgoing_mail_message.html = `<p>unlink html error: ${error}</p>`;
                            }
                            logger.log('info','File ' + appdir + printdir + path + '.html' + ' removed successfully.');
                        });
                    }
                });
                //Skicka mail om något gått fel vid kopiering/ta bort
                if (outgoing_mail_message.html != "") {
                    sendemail(outgoing_mail_message);
                }
            };
            var onJobError = function (message) {
                logger.log('error', this.identifier + ", error: " + message);
                outgoing_mail_message.text = `this.identifier + ", error: ${message}`;
                outgoing_mail_message.html = `<p>this.identifier + ", error: ${message}`;
                if (outgoing_mail_message.html != "") {
                    sendemail(outgoing_mail_message);
                }
            };

            jobFile.on("end", onJobEnd);
            jobFile.on("error", onJobError);
        } catch(e) {
            logger.log('error', `${e}`);
            outgoing_mail_message.text = ` general error: ${error}`;
            outgoing_mail_message.html = `<p>general error: ${error}</p>`;
            if (outgoing_mail_message.html != "") {
                sendemail(outgoing_mail_message);
            }
        }
    });
})
.on('remove', async path => {logger.log('info','File ' + path + ' removed.');});
