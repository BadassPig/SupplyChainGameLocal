"use strict";

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var session = require('express-session');
var socket_io  = require('socket.io');

// Database
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/supplyChainGame_1');

var app = express();

// set io in app
var io = socket_io();
app.io = io;

var routes = require('./routes/index');
var users = require('./routes/users');
var game = require('./routes/game')(io);


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');  // Express uses Jade as default view engine; Jade was renamed Pug. Might need to update express

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser('keyboard cat'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: {} // for prod security: { secure: true }
}))
app.use(passport.initialize());
app.use(passport.session());

// Initialize Passport and restore authentication state, if any, from the
// session.
passport.serializeUser(function(user, done) {
  /*user: { _id: 584a1e982f698c24641b3639,
    userName: 'testPlayer1',
    userRole: 'player',
    userPassword: '123456' }*/
  //console.log('passport.serializeUser');
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  //console.log('passport.deserializeUser');
  done(null, user);
});
// app.use(passport.initialize());
// app.use(passport.session());

// Make our db accessible to our router
app.use(function(req,res,next){
    req.db = db;
    next();
});

app.use('/', routes);
app.use('/users', users);
app.use('/game', game);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    console.log('Handling dev err: ' + err);
    res.status(err.status || 500);
    // Not sure if the render works here.
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  console.log('Handling prod err: ' + err);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

passport.use(new LocalStrategy(
    function(username, password, done) {
    //console.log('In LocalStrategy implementation.');
    var collection = db.get('userlist');
    collection.find({ userName: username}, {}, function(e, docs) {
        if (e !== null) {
          console.log('Find user ' + username + ' failed at db.');
          return done(e);
        }
        else if (docs.length == 0) {
          console.log('No record found for ' + username);
          return done(null, false);
        } else if (docs[0].userPassword !== password) {
          console.log('Invalid passowrd for ' + username);
          return done(null, false, {message: 'Invalid password.'});
        }
        //console.log(docs);
        return done(null, docs);
    });
}));

module.exports = app;
