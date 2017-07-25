"use strict;"
var express = require('express');
var router = express.Router();
var passport = require('passport');

router.get('/userManagementPage', function(req, res, next) {
  res.render('userManagementPage', { title: 'User Management Page' });
});

// No validation
// router.get('/instructorGamePage/:instructor', function(req, res, next) {
//   res.render('instructorGamePage', { title: 'Game Page for ' + req.params.instructor });
// });

// With passport validation
router.get('/instructorGamePage/:instructor', function(req, res, next) {
  if (!req.isAuthenticated()) {
    console.log('Retrieving instructor page for user ' + req.params.instructor + ' can\'t be aunthenticated, back to login page');
    res.redirect('/');
    return ;
  }
  res.render('instructorGamePage', { title: 'Game Page for ' + req.params.instructor });
});

// router.get('/playerGamePage/:player', function(req, res, next) {
//   passport.authenticate('local', function(err, user, info) {
//     console.log('Custom callback for authentication in /playerGamePage/:player');
//     console.log('err: ' + err);
//     console.log('user:');
//     console.log(user);
//     console.log('info:');
//     console.log(info);
//     if (err) { return next(err); }
//     if (!user) { return res.redirect('/'); }
//     req.logIn(user, function(err) {
//       if (err) { return next(err); }
//       return res.redirect('/playerGamePage/' + user.username);
//     });
//   })(req, res, next);
// });

/*
 * Routes for player when requesting game page. Validation added.
 */
router.get('/playerGamePage/:player', function(req, res, next) {
  if (!req.isAuthenticated()) {
    console.log('Retrieving player page for user ' + req.params.player + ' can\'t be aunthenticated, back to login page');
    res.redirect('/');
    return ;
  }
  // Doesn't matter what player page the user requests, direct to his page!
  //console.log(req.session.passport);
  //var player = req.session.passport.user[0].userName;
  var player = req.params.player;
  console.log('Validated request of playerGamePage for ' + player);
  res.render('playerGamePage', { title: player + ' Game Page' });
});

/*
 * Routes for player when requesting game page. No validation. (For speedy test; for validation use the code above)
 */
// router.get('/playerGamePage/:player', function(req, res, next) {
//     res.render('playerGamePage', { title: req.params.player + ' Game Page' });
//   }
// );

router.get('/', function(req, res, next) {
  //console.log('/ session:');
  //console.log(req.session.passport);
  // req.session.passport.user
  // { user:
  //    [ { _id: '584a1e982f698c24641b3639',
  //        userName: 'testPlayer1',
  //        userRole: 'player',
  //        userPassword: '123456' } ] }
  if (req.isAuthenticated()) { // Session still in effect
    console.log('Session still available for ' + req.session.passport.user[0].userName);
    var role = req.session.passport.user[0].userRole;
    if (role === 'player')
      res.redirect('/playerGamePage/' + req.session.passport.user[0].userName);
    else if (role === 'instructor')
      res.redirect('/instructorGamePage/' + req.session.passport.user[0].userName);
  }
  else
    res.render('index', { title: 'Login Page', user: '' });
});

// router.get('/error', function(req, res, next) {
// 	res.render('error', {
// 	      message: 'err.message',
// 	      error: 'err'
// 	    });
// });



module.exports = router;
