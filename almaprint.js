/*
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
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    port: 25,
    host: 'localhost',
    tls: {
      rejectUnauthorized: false
    },
});
var mailmessage = {
    from: 'kthb@alma.lib.kth.se',
    to: 'tholind@kth.se',
    subject: 'Error Alma Printing',
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

logger.log('info',"Alma Print service started");
mailmessage.subject = `Alma Printing`;
mailmessage.text = `Alma Print service started`;
mailmessage.html = `<p>Alma Print service started</p>`;
transporter.sendMail(mailmessage, (error, info) => {
    if (error) {
        return logger.log('error',error);
    }
    logger.log('info','Message sent: %s', info.messageId);
});

watcher
.on('error', error => logger.log('error',`Watcher error: ${error}`))

.on('add', async path => {
    logger.log('info',`File ${appdir + maildir + path} has been added`);
    let source = fs.createReadStream(appdir + maildir + path);

    source.on('error', function(error) {
        logger.log('error',`open mail file error: ${error}`)
        mailmessage.text = `open mail file error: ${error}`;
        mailmessage.html = `<p>open mail file error: ${error}</p>`;

    });

    source.on('open', async function () {
        try {
            let parsed = await simpleParser(source);
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
            if(parsed.subject == "Resource Request" 
            || parsed.subject == "Transit" 
            || parsed.subject == "Cash Receipt" 
            || parsed.subject == "Kvitto") {
                printformat = "A5";
                if(parsed.to.text == process.env.TELGEEMAIL) {
                    printformat = "A4" //Telge har bara ett fack i sin skrivare för närvarande.
                }
            }
            //Skapa pdf från email(HTML)
            if(parsed.html) {
                incomingmailcontent = parsed.html;
            } else {
                incomingmailcontent = parsed.text
            }
            fs.writeFile(appdir + printdir + path + '.html', incomingmailcontent, function(error){ 
                if (error) {
                    logger.log('error',`Watcher error: ${error}`)
                    mailmessage.text = `Watcher error: ${error}`;
                    mailmessage.html = `<p>Watcher error: ${error}</p>`;
                }
            });
        
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            
            page.on('error', error=> {
                logger.log('error',`chromium browser error at page: ${error}`)
                mailmessage.text = `chromium browser error at page: ${error}`;
                mailmessage.html = `<p>chromium browser error at page: ${error}</p>`;
            });
            
            page.on('pageerror', error=> {
                logger.log('error',`chromium pageerror: ${error}`)
                mailmessage.text = `chromium pageerror: ${error}`;
                mailmessage.html = `<p>chromium pageerror: ${error}</p>`;
            })
            
            await page.goto('file://' + appdir + printdir + path + '.html');
            
            await page.pdf({ format: printformat, path: appdir + printdir + path + '.pdf', margin: printmargin });
            
            await browser.close();
            //Skriv ut
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
                fs.copyFile(appdir +  printdir + path + '.pdf', appdir + printhistorydir +  path + '_'+ Date.now() +'.pdf', (error) => {
                    if (error) { 
                        logger.log('error',`copyfile pdf error: ${error}`);
                        mailmessage.text = `copyfile pdf error: ${error}`;
                        mailmessage.html = `<p>copyfile pdf error: ${error}</p>`;
                    } else {
                        logger.log('info', appdir +  printdir + path + '.pdf copied to' + appdir + printhistorydir +  path);

                        fs.unlink(appdir + maildir + path,function (error) {
                            if (error) {
                                logger.log('error',`unlink error: ${error}`);
                                mailmessage.text = `unlink error: ${error}`;
                                mailmessage.html = `<p>unlink error: ${error}</p>`;
                            }
                            logger.log('info','File ' + appdir + maildir + path + ' removed successfully.');
                        });
                        fs.unlink(appdir + printdir + path + '.pdf',function (error) {
                            if (error) {
                                logger.log('error',`unlink pdf error: ${error}`);
                                mailmessage.text = `unlink pdf error: ${error}`;
                                mailmessage.html = `<p>unlink pdf error: ${error}</p>`;
                            }
                            logger.log('info','File ' + appdir + printdir + path + '.pdf' + ' removed successfully.');
                        });
                    }
                });
                fs.copyFile(appdir +  printdir + path + '.html', appdir + printhistorydir +  path + '_'+ Date.now() +'.html', (error) => {
                    if (error) { 
                        logger.log('error',`copyfile error: ${error}`);
                        mailmessage.text = `copyfile html error: ${error}`;
                        mailmessage.html = `<p>copyfile html error: ${error}</p>`;
                    } else {
                        logger.log('info', appdir +  printdir + path + '.html copied to' + appdir + printhistorydir +  path);

                        fs.unlink(appdir + printdir + path + '.html',function (error) {
                            if (error) {
                                logger.log('error',`unlink error: ${error}`);
                                mailmessage.text = `unlink html error: ${error}`;
                                mailmessage.html = `<p>unlink html error: ${error}</p>`;
                            }
                            logger.log('info','File ' + appdir + printdir + path + '.html' + ' removed successfully.');
                        });
                    }
                });
                if (mailmessage.html != "") {
                    transporter.sendMail(mailmessage, (error, info) => {
                        if (error) {
                            return logger.log('error',error);
                        }
                        logger.log('info','Message sent: %s', info.messageId);
                    });
                }
            };
            var onJobError = function (message) {
                logger.log('error', this.identifier + ", error: " + message);
            };

            jobFile.on("end", onJobEnd);
            jobFile.on("error", onJobError);
        } catch(e) {
            logger.log('error', `${e}`);
            mailmessage.text = ` general error: ${error}`;
            mailmessage.html = `<p>general error: ${error}</p>`;
            if (mailmessage.html != "") {
                transporter.sendMail(mailmessage, (error, info) => {
                    if (error) {
                        return logger.log('error',error);
                    }
                    logger.log('info','Message sent: %s', info.messageId);
                });
            }
        }
    });
})
.on('remove', async path => {logger.log('info','File ' + path + ' removed.');});
