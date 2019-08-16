const winston = require('winston');

global.logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports : [
        new winston.transports.Console({format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.prettyPrint()
        )}), 
        new winston.transports.File({filename: "logs/combined.log", timestamp: true}),
        new winston.transports.File({filename: "logs/error.log", level: 'error', timestamp: true})]

});