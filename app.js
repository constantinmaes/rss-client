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

cron.schedule('* * * * *', async () => {
    console.log('Scheduled job');
    // Tableau de liens RSS
    const feeds = await myDatabase.all('SELECT * FROM feeds');
    feeds.forEach(async (feed) => {
        try {
            const { data } = await axios.get(feed.link);
            const obj = await xml2js.parseStringPromise(data);
            const title = obj.rss.channel[0].title[0];
            const news = obj.rss.channel[0].item;
            // Sauvegarder les news dans la base de données
            news.forEach((newsItem) => {
                myDatabase
                    .run(
                        'INSERT INTO items (title, link, description, pubDate, feedId) VALUES (?, ?, ?, ?, ?)',
                        newsItem.title[0],
                        newsItem.link[0],
                        newsItem.description[0],
                        newsItem.pubDate[0],
                        feed.id
                    )
                    .catch((err) => {
                        console.error('Error inserting news', err);
                    });
            });
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
            'CREATE TABLE IF NOT EXISTS feeds (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, link TEXT, UNIQUE (link))'
        );
        myDatabase.run(
            'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, link TEXT, description TEXT, pubDate TEXT, feedId INTEGER NOT NULL, UNIQUE (link), FOREIGN KEY (feedId) REFERENCES feeds(id) ON DELETE CASCADE)'
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
        const title = 'test';
        const news = await myDatabase.all('SELECT * FROM items');
        res.render('rss', { news, title });
    } catch (err) {
        console.error('Something happened', err);
    }
});

// Add feed
app.get('/add-feed', (req, res) => {
    res.render('add-feed');
});

app.post('/add-feed', async (req, res) => {
    const { title, link } = req.body;
    try {
        await myDatabase.run(
            'INSERT INTO feeds (title, link) VALUES (?, ?)',
            title,
            link
        );
        res.redirect('/');
    } catch (err) {
        console.error('Error inserting feed', err);
        res.redirect('/add-feed');
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
