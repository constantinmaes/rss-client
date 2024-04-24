var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const axios = require('axios');
const xml2js = require('xml2js');
const sqlite3 = require('sqlite3').verbose();
const openDb = require('sqlite').open;
let myDatabase;

const cron = require('node-cron');

cron.schedule('* * * * *', () => {
    console.log('Scheduled job');
    // Tableau de liens RSS
    const links = ['...'];
    links.forEach(async (url) => {
        try {
            const { data } = await axios.get(url);
            const obj = await xml2js.parseStringPromise(data);
            const title = obj.rss.channel[0].title[0];
            const news = obj.rss.channel[0].item;
            // Sauvegarder les news dans la base de données
        } catch (err) {
            console.error('Something happened', err);
        }
    });
});

openDb({
    filename: './rss.sqlite',
    driver: sqlite3.Database,
})
    .then((db) => {
        myDatabase = db;
        console.log('Database opened');
        myDatabase.run(
            'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, link TEXT, description TEXT, pubDate TEXT)'
        );
    })
    .catch((err) => {
        console.error(err);
    });

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// RSS function
app.get('/rss', async (req, res) => {
    try {
        const url = req.query.url; // localhost:3000/rss?url=https://www.reddit.com/.rss
        if (!url) {
            return res.status(400).send('No URL provided');
        }
        console.log('IN RSS ROUTE');
        const { data } = await axios.get(url);
        // const axiosResponse = await axios.get(url);
        // const data = axiosResponse.data;
        // console.log(data); // data contient le XML brut
        const obj = await xml2js.parseStringPromise(data);
        // console.log(require('util').inspect(obj, { depth: null }));
        const title = obj.rss.channel[0].title[0];
        const news = obj.rss.channel[0].item;
        //return res.json(news);
        res.render('rss', { news, title });
    } catch (err) {
        console.error('Something happened', err);
    }
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
