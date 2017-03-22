"use strict";

var express = require('express');
var router = express.Router();
var passport = require('passport');


/* The following 'routes' consider the routes as different services that belong to this users page. users page itself can be considered a service.
*/

/*
 * GET userlist.
 */
router.get('/userlist', function(req, res) {
    var db = req.db;
    var collection = db.get('userlist');
    collection.find({},{},function(e,docs){
        res.json(docs);
    });
});

/*
 * POST to adduser.
 */
router.post('/adduser', function(req, res) {
    var db = req.db;
    var collection = db.get('userlist');
    collection.insert(req.body, function(err, result){
        res.send(
            (err === null) ? { msg: '' } : { msg: err }
        );
    });
});

/*
 * DELETE to deleteuser.
 */
router.delete('/deleteuser/:id', function(req, res) {
    var db = req.db;
    var collection = db.get('userlist');
    var userToDelete = req.params.id;
    collection.remove({ '_id' : userToDelete }, function(err) {
        res.send((err === null) ? { msg: '' } : { msg:'error: ' + err });
    });
});

// Authenticate only validates userName and userPassword in db, here we still need to check role of user.
router.post('/login',
    passport.authenticate('local'),
    function(req, res) {
        // If this function gets called, authentication was successful.
        console.log('Login successful for ' + req.body.username);
        const collection = req.db.get('userlist');
        collection.find({'userName' : req.body.username}, 'userRole').then((docs)=> {
            if (docs) {
                if (docs[0].userRole === 'instructor')
                    res.redirect('/instructorGamePage/' + req.body.username);
                else if (docs[0].userRole === 'player') {
                    console.log('Redirecting to playerGamePage for ' + req.body.username);
                    res.redirect('/playerGamePage/' + req.body.username);
                }
            }
        });
});

/*
 * Non passport way of login.
 */
// router.post('/login',
//     function(req, res) {
//         const collection = req.db.get('userlist');
//         collection.find({'userName' : req.body.username, 'userPassword' : req.body.password}, 'userRole').then((docs)=> {
//             console.log('Login validation (non Passport) ... for ' + req.body.username + '/' + req.body.password);
//             //console.log(docs);
//             if (docs.length > 0) {
//                 console.log('Found record.');
//                 if (docs[0].userRole === 'instructor')
//                     res.redirect('/instructorGamePage');
//                 else if (docs[0].userRole === 'player') {
//                     //console.log('Redirecting to playerGamePage for ' + req.body.username);
//                     res.redirect('/playerGamePage/' + req.body.username);
//                 }
//             } else {
//                 console.log('Login validation failed (non Passport).');
//                 res.send('Invalid username/password.');
//             }
//         });
// });

router.get('/logout/:user', function(req, res) {
    if (!req.isAuthenticated()) {
        console.log('Log out action for can\'t be aunthenticated');
        return ;
    }
    //console.log(req.session.passport);
    var player = req.session.passport.user[0].userName;
    console.log('Logout action for ' + player);
    req.logout();
    // Or redirect?
    //console.log('Redirecting...');
    res.send('Logged out');
    //res.render('index', { title: 'Login Page', user: '' });
    //res.redirect('/');
    //res.render('index', { title: 'Login Page', user: '' });
});

module.exports = router;
