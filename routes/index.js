var express = require('express');
var router = express.Router();

router.get('/userManagementPage', function(req, res, next) {
  res.render('userManagementPage', { title: 'User Management Page' });
});

router.get('/instructorGamePage', function(req, res, next) {
  res.render('instructorGamePage', { title: 'Game Page' });
});

router.get('/playerGamePage/:player', function(req, res, next) {
  res.render('playerGamePage', { title: req.params.player + ' Game Page' });
});

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Login Page', user: req.user });
});

// router.get('/error', function(req, res, next) {
// 	res.render('error', {
// 	      message: 'err.message',
// 	      error: 'err'
// 	    });
// });



module.exports = router;
