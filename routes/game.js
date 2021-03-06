"use strict";
// This is the server side (more like expressjs) javascript. This file is not run on client side. It handles request from both instructor and player
// For now only consider single instructor session.

// TODO
// Make game data per instructor
// The way of creating multiple players is a bit naive, it's going to be more complicated when multiple instructor plays the game simutaneously


var express = require('express');
var router = express.Router();
// var SSE = require('express-sse');
// var sse = new SSE();  // SSE connection for instructor
// var ssePlayer = new SSE(); // sse connection for player.
var passport = require('passport');
const nodemailer = require('nodemailer');
// var app = express();
// var io = app.io;

function ServerGameStatus() {
  this.gameID       = 0;
  this.numPlayer    = 0;
  this.numRound     = 0;
  this.currentRound = 0;
  this.currentRoundCalculated = false;
  this.instructorRequestOk    = false;
  this.gameEnded              = false;
  this.playerList     = [];
  this.playerGameData = []; // [[player1 data],[player2 data]]. Because Mongo DB doesn't allow key to contain $ and ., just store player game data in arrays; the order of arrays are the same as player names in playerList
  this.getPlayerGameData = function( player ) {
    var index = this.playerList.indexOf(player);
    if (index == -1)
      return [];
    return this.playerGameData[index];
  };
  this.setPlayerOrder = function( player, order, round ) {  // set the order for player
    var currentRound = !round ? this.currentRound : round;
    var pD = this.getPlayerGameData(player);
    if (pD.length < currentRound)
      return ;
    pD[currentRound].order = order;
  };
  this.clear = function () {
    this.gameID       = 0;
    this.numPlayer    = 0;
    this.numRound     = 0;
    this.currentRound = 0;
    this.currentRoundCalculated = false;
    this.instructorRequestOk    = false;
    this.gameEnded              = false;
    this.playerList     = [];
    this.playerGameData = [];
  };
  this.gameDataClear = function () {
    this.currentRound   = 0;
    this.currentRoundCalculated = false;
    this.gameEnded              = false;
    this.playerGameData = [];
    this.playerList.map(obj=>{
      this.playerGameData.push([]);
    })
  }
}

var gameDataPerInstructor = {}; // {<instructorId> : <serverGameStatus>}

function GameParam() {
  this.supplyPerPlayer = 12.5;
  this.salePrice       = 10;
  this.cost            = 2;
  this.getProfit = function () {
    return this.salePrice - this.cost;
  };
};

var gameParamPerInstructor = {};

var playerInstructorMap = {}; // <player> : <instructor>

var socketIOconns = {}; // {user : socket};

function clearServerGameStatus(instructor) {
  if (gameDataPerInstructor[instructor])
    gameDataPerInstructor[instructor].clear();
  else
    console.log('clearServerGameStatus invoked for ' + instructor + ' but game data not found.');
  //serverGameStatus.clear();
}

// Save current game data to DB
// This sequential code should be changed to call backs or promise
function saveServerGameStatus(req, res) {
  var instructor = req.params.instructorID;
  if (!gameDataPerInstructor[instructor]) {
    console.log('Can\'t find game data for ' + instructor + ', saveServerGameStatus failed.');
    res.send({instructorRequestOk: false});
    return ;
  }
  var thisData = gameDataPerInstructor[instructor];  // shorter var name
  var dbGameTable = req.db.get('gameData');
  var query = {
    Time        : thisData.gameID,
    Instructor  : instructor
  };
  console.log('Saving game data for instructor ' + instructor + ' game ID ' + query.Time);
  if (dbGameTable.count(query) > 0) {
    console.log('Game for instructor ' + instructor + ' at time ' + (new Date(query.Time)) + ' already exists, override.');
    dbGameTable.remove(query);
  }
  query = {
    Time        : thisData.gameID,
    Instructor  : instructor,
    NumPlayer   : thisData.numPlayer,
    NumPeriod   : thisData.numRound,
    GameData    : thisData
  };
  // console.log('About to insert into DB with query:');
  // console.log(query);
  dbGameTable.insert(query,
    function (err, result) {
      if (err) {
        console.log('Saving game data failed at DB for the following reason:');
        console.log(err);
        res.send({instructorRequestOk: false});
      } else {
        clearServerGameStatus(instructor);
        res.send({instructorRequestOk: true});
    }
  });
}

/*
 * Instructor HTTP request handle START
 */
router.get('/instructorGetGameParams', function(req, res){
  var instructor = req.params.instructorID;
  if (gameParamPerInstructor[instructor])
    res.send(gameParamPerInstructor[instructor].gameParam);
  else
    res.send(new GameParam());  // Send default
});

/*
 * Get game data. In case instructor refresh page during the game.
 */
router.get('/instructorGetGameData', function(req, res){
  // Request sent using $.getJSON(), where data is appended to URL as a query string
  var ins = req.query.instructor;
  //console.log('Instructor ' + req.query.instructor + ' just requested game data.');
  if (gameDataPerInstructor[ins])
    res.send(gameDataPerInstructor[ins]);
  else {
    //console.log('Failed instructorGetGameData route, can\'t find game data for ' + ins);
    res.send({});
  }
});

router.get('/getAllOldGame', function(req, res) {
  var dbGameTable = req.db.get('gameData');
  var query = {};
  var ins = req.query.instructor;
  if (ins)
    //query = { Instructor : req.query.instructor };
    query.Instructor = ins;
  else
    query["GameData.playerList"] = {$all:[req.query.player]};

  // Should limit what this find returns, only need a game list here not the entire game.
  dbGameTable.find(query).then(docs=>{
    if (docs) {
      // console.log('Found old game data for ' + instructor);
      //console.log(docs);
      var respond = [];
      docs.map(function(obj) {
        var temp = {
          Time        : obj.Time,
          NumPlayer   : obj.NumPlayer,
          NumPeriod   : obj.NumPeriod,
        }
        respond.push(temp);
      });
      //console.log(respond);

      res.send(respond);
    } else {
      console.log('Old game data for ' + ins + ' not found.');
    }
  });
 });

router.get('/getOldGameById', function(req, res) {
  var gameId = req.query.gameID;
  var instructor = req.query.instructor;
  var player = req.query.player;
  console.log((instructor ? 'Instructor ' : 'Player ') + (instructor || player) + ' just requested old game ' + gameId);
  var dbGameTable = req.db.get('gameData');
  var query = {Time : parseInt(gameId)};
  if (instructor)
    query.Instructor = instructor;
  else {
    //query["GameData.playerList"] = {$all:["long.adams@gmail.com"]};
    query["GameData.playerList"] = {$all:[player]};
  }
  // console.log('DB query:');
  // console.log(query);
  //db.gameData.find({"GameData.playerList" : {$all:["long.adams@gmail.com"]}});
  dbGameTable.find(query)
  .then(docs=>{
    console.log('DB found ' + docs.length + ' records for ' + (instructor || player));
    if (docs) {  // Should be unique
      // Should only send game data for the player if it's player request.
      if (player) {
        var index = docs[0].GameData.playerList.indexOf(player);
        //console.log('The index in game list of player ' + player + ' is ' + index);
        if (index != -1)
          res.send(docs[0].GameData.playerGameData[index]);
      } else
        res.send(docs[0]);
    }
  }, error=> {
    console.log('DB find failed with error ' + error);
  });
});

/*
 * POST to start game.
 */
router.post('/startGame/:instructor', function(req, res) {
  //var db = req.db;
  var ins = req.params.instructor;
  console.log('Received game start request from ' + ins);
  // clear game status if exists otherwise create instance of gameServerStatus
  var thisData = gameDataPerInstructor[ins];
  if (thisData)
    clearServerGameStatus(ins);
  else 
    thisData = gameDataPerInstructor[ins] = new ServerGameStatus();
  var thisData = gameDataPerInstructor[ins];
  thisData.numPlayer = req.body.numPlayers;
  thisData.numRound = req.body.numRounds;
  var thisParam = gameParamPerInstructor[ins];
  if (!thisParam)
    thisParam = gameParamPerInstructor[ins] = new GameParam();
  thisParam.supplyPerPlayer = req.body.supplyPerPlayer;
  thisParam.salePrice = req.body.salePrice;
  thisParam.cost = req.body.cost;
  
  // It seems if a JSON object is sent directly there are some serilization/deserilization tricks behid the scene.
  //console.log(typeof req.body['playerEmails[]']);
  let playerEmailsArray = [];
  if (typeof req.body['playerEmails[]'] === 'string')
    playerEmailsArray.push(req.body['playerEmails[]']);
  else
    playerEmailsArray = req.body['playerEmails[]'];
  for (var i = 0; i < playerEmailsArray.length; ++ i) {
    var playerName = playerEmailsArray[i];
    thisData.playerList.push(playerName);
    thisData.playerGameData[i] = [];
    playerInstructorMap[playerName] = req.params.instructor;

    // TODO: playerName could be the same
    addUserToDB('player', playerName, req.params.instructor, req.db, playerName);
  }
  thisData.instructorRequestOk = true;
  thisData.gameID = (new Date()).getTime();
  gameGen(thisData);
  //console.log(serverGameStatus);

  //res.gameStartOk = true;
  //res.playerNames = serverGameStatus.playerList;
  //console.log('serverGameStatus:');
  //console.log(thisData);
  res.send(thisData);
  thisData.playerList.map(function(player) {
    if (socketIOconns[player])
      socketIOconns[player].emit('calculation result', thisData.getPlayerGameData(player));
  });
});

router.post('/restartGame/:instructorID', function(req, res) {
  var ins = req.params.instructorID;
  console.log('Instructor ' + ins + ' just requested game restart.');
  var thisData = gameDataPerInstructor[ins];
  thisData.gameDataClear();
  thisData.gameID = (new Date()).getTime();
  gameGen(thisData);
  // console.log('Game data after restart:');
  // console.log(thisData);
  thisData.playerList.map(function(player) {
    if (socketIOconns[player])
      //socketIOconns[player].emit('game restart', {});
      socketIOconns[player].emit('calculation result', thisData.getPlayerGameData(player));
  });
  //res.send(thisData);
  res.send({instructorRequestOk: true});
});

router.post('/resetGame/:instructorID', function(req, res) {
  var ins = req.params.instructorID;
  console.log('Instructor ' + ins + ' just requested game reset.');
  clearServerGameStatus(ins);
  res.send({instructorRequestOk: true});
});

router.post('/endGame/:instructorID', function(req, res) {
  var ins = req.params.instructorID;
  console.log('Instructor ' + ins + ' just requested game end.');
  saveServerGameStatus(req, res);
  gameDataPerInstructor[ins].gameEnded = true;
});

/*
 * POST to go to next round.
 */
router.post('/nextRound/:instructorID', function(req, res) {
  var ins = req.params.instructorID;
  var thisData = gameDataPerInstructor[ins];
  if (thisData.currentRoundCalculated) {
    thisData.currentRound ++;
    thisData.currentRoundCalculated = false;
  } else
    // next round button hit more than once for this instructor, only register one
    return
  gameGen(thisData);
  res.send(thisData);
  thisData.playerList.map(function(player) {
    if (socketIOconns[player])
      socketIOconns[player].emit('calculation result', thisData.getPlayerGameData(player));
  });
});

/*
 * POST to calculate per round result.
 */
router.post('/calculate/:instructorID', function(req, res) {
  var ins = req.params.instructorID;
  var thisData = gameDataPerInstructor[ins];
  calcGameData(ins, thisData);
  res.send(thisData);
  thisData.playerList.map(function(player) {
    if (socketIOconns[player])
      socketIOconns[player].emit('calculation result', thisData.getPlayerGameData(player));
  });
});

router.delete('/deleteGame/:instructor/:gameID', function(req, res) {
  var gameId = req.params.gameID;
  var instructor = req.params.instructor;
  var dbGameTable = req.db.get('gameData');
  dbGameTable.remove({Time : parseInt(gameId), Instructor : instructor}, function (err, result) {
      if (err)
        console.log(err);
  });
  console.log('Instructor ' + instructor + ' just requested to delete game ' + gameId + ', successful.');
  res.send('Success');
});

router.get('/reloadGame/:instructor/:gameID', function(req, res) {
  var gameId = req.params.gameID;
  var instructor = req.params.instructor;
  var dbGameTable = req.db.get('gameData');
  var query = {Time : parseInt(gameId)};
  if (instructor)
    query.Instructor = instructor;
  else {
    res.send('Can\'t reload game for non-instructor.');
    return ;
  }
  dbGameTable.find(query)
  .then(docs=>{
    console.log('reloadGame: DB found ' + docs.length + ' records for ' + instructor);
    if (docs.length === 1)
      res.send(docs[0]);
  }, error=> {
    console.log('DB find failed with error ' + error);
  });
  console.log('Instructor ' + instructor + ' just requested to reload game ' + gameId + ', successful.');
  //res.send('Success');
});

/*
 * Instructor HTTP request handle END
 */

/*
* Player HTTP request handle START
*/

router.get('/getPlayerTable/:player', function(req, res) {
  var player = req.params.player;
  var ins = playerInstructorMap[player];
  if (!req.isAuthenticated()) {
      console.log('getPlayerTable for ' + player + ' can\'t be authenticated.');
      return ;
  }
  console.log('Player ' + player + ' just requested game table.');
  var thisData = gameDataPerInstructor[ins];
  if (!thisData) {
    res.send({}); // No current game for player.
    return ;
  }
  var index = thisData.playerList.indexOf(player);
  if (index >= 0)
    res.send(thisData.playerGameData[index]);
  else
    throw 'No record in playerGameData for ' + player;
});

// authenticate user request.
// This probably should happen in middleware.
// router.get('/getPlayerTable/:player', passport.authenticate('local'), function(req, res) {
//   var player = req.params.player;
//   console.log('Player ' + player + ' just requested game table.');
//   if (serverGameStatus.playerGameData.hasOwnProperty(player)) {
//     //console.log('Sending data: ' + serverGameStatus.playerGameData[player]);
//     res.send(serverGameStatus.playerGameData[player]);
//   }
//   else {
//     // Need to handle error correctly
//     throw 'No record in playerGameData for ' + player;
//   }
// });

router.post('/submitOrder/:player', function(req, res) {
  var player = req.params.player;
  var order = req.body.newOrder;
  var ins = playerInstructorMap[player];
  console.log('Received order ' + order + ' from ' + player);
  var thisGameData = gameDataPerInstructor[ins];
  var thisPlayerData = thisGameData.getPlayerGameData(player);
  thisPlayerData[thisGameData.currentRound].order = order;
  thisGameData.setPlayerOrder(player, order);
  if (socketIOconns[ins])
    socketIOconns[ins].emit('player submit order', {player: player, order: order});
  res.send({'submitOK' : true});
});

/*
* Player HTTP request handle END
*/

// Generate a random number between x and x + y, return is a string, not number.
function getRandNum(x, y) {
  if (x == undefined || !Number.isInteger(x))
    x = 5;
  if (y == undefined || !Number.isInteger(y))
    y = 10;
  if (Number.isInteger(x) && Number.isInteger(y))
    return ((Math.random() * y) + x).toFixed(2);
  else
    return ((Math.random() * 10) + 5).toFixed(2);
}

// Generate a random string of given length
function genRandomString(l)
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < l; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

/*
 * Game number generator, this is at the beginning of round
 */
 function gameGen(serverGameStatus) {
  //console.log('In gameGen()');
  var isDemoRound = serverGameStatus.currentRound === 0;
  serverGameStatus.currentRoundCalculated = isDemoRound;
  for (var i = 0; i < serverGameStatus.playerList.length; ++ i) {
    serverGameStatus.playerGameData[i].push({
      //demand: isDemoRound ? 8.59 : parseFloat(getRandNum()),  // toFixed returns a string
      demand: isDemoRound ? 8.59 : '',  // toFixed returns a string
      ration: isDemoRound ? 12.5 : '',
      sales: isDemoRound ? 8.59 : '',
      lostSales: isDemoRound ? '0.00' : '',
      surplusInv: isDemoRound ? 3.91 : '',
      profit: isDemoRound ? 60.90 : '',
      cumuProfit: isDemoRound ? 60.90 : '',
      order: isDemoRound ? 12.5 : ''
    });
    //console.log(serverGameStatus.playerGameData);
  }
 };

 /*
  * Calculate game data after all players have submitted orders.
  */
function calcGameData(instructor, serverGameStatus) {
  console.log('--- calcGameData ---');
  if (serverGameStatus.currentRoundCalculated) {
    console.log('Already calcualted round ' + serverGameStatus.currentRound + ' for instructor ' + instructor + ', will not calcualte again.');
    return ;
  }
  var c = serverGameStatus.currentRound;
  var totalOrd = 0;

  serverGameStatus.playerGameData.map(data => totalOrd += parseFloat(data[c].order));
  var gameParam = gameParamPerInstructor[instructor] ? gameParamPerInstructor[instructor] : new GameParam();
  var totalSupply = gameParam.supplyPerPlayer * serverGameStatus.numPlayer;
  console.log('Total orders from all players: ' + totalOrd + ', total supply ' + totalSupply);
  serverGameStatus.playerGameData.map( data => {
    var pD = data[c];
    var pDorder = parseFloat(pD.order);
    pD.demand = parseFloat(getRandNum());
    pD.ration = Math.min(pDorder, (totalSupply * pDorder) / totalOrd).toFixed(2);
    //pD.ration = parseFloat((gameParam.supplyPerPlayer * pDorder / totalOrd).toFixed(2));
    pD.sales = Math.min(parseFloat(pD.demand), parseFloat(pD.ration));
    pD.lostSales = Math.max(pD.demand - pD.ration, 0).toFixed(2);
    pD.surplusInv = parseFloat(Math.max(pD.ration - pD.demand, 0).toFixed(2));
    pD.profit = parseFloat((pD.sales * gameParam.getProfit() - pD.surplusInv * gameParam.cost).toFixed(2));
    if (c - 1 >= 0)
      pD.cumuProfit = (parseFloat(data[c - 1].cumuProfit) + pD.profit).toFixed(2);
  });

  serverGameStatus.currentRoundCalculated = true;
};

// Add new player associated with instructor to db. If player already exists, return password.
function addUserToDB(role, username, instructor, db, email) {
  var collection = db.get('userlist');
  if (role === 'player') {
    var query = {userName : username, userRole : 'player', instructor : instructor };
    collection.findOne(query).then(doc=>{
      if (doc) {
        console.log('Found record for ' + username);
        emailUser(email, username + '/' + doc.userPassword);
      }
      else {
        console.log('Adding record for ' + username);
        var pwd = genRandomString(6);
        collection.insert({
          'userName' : username,
          'userRole' : role,
          'instructor' : instructor,
          'userPassword' : pwd
        }).then(emailUser(email, username + '/' + pwd));
      }
    });
  }
};

function emailUser(email, text) {
  // Might be more efficient to create transporter only once
  let transporter = nodemailer.createTransport({
      service: 'yahoo',
      auth: {
          user: 'yilongnodemail@yahoo.com',
          pass: 'Yah00yahoo'
      }
  });
  //console.log('Transporter created.');

  let mailOptions = {
    from: '"SupplayChainGame" <yilongnodemail@yahoo.com>', // sender address
    to: email, // list of receivers
    subject: 'Supply Chain Game', // Subject line
    text: text//, // plain text body
    //html: '<b>Hello world ?</b>' // html body
  };
  console.log('Sending e-mail to ' + email + ' with text ' + text);
  transporter.sendMail(mailOptions, (error, info) => {
    if (error)
      return console.log(error);
    console.log('Message %s sent: %s', info.messageId, info.response);
  });
}

//module.exports = router;
// Make io available in routes and define io functionality in routes instead of app.js
module.exports = function(io) {
  io.on('connection', function(socket) {
    //console.log('Socket.io connection.');
    socket.on('add instructor', function(instructor) {
      console.log('Socket.io: ' + 'instructor ' + instructor + ' just connected.');
      socketIOconns[instructor] = socket;
    });
    socket.on('add player', function(player) {
      console.log('Socket.io: ' + 'player ' + player + ' just connected.');
      socketIOconns[player] = socket;
    });
    socket.on('disconnect', function() {
      console.log('Socket.io: ' + 'User disconnected.');
    });
  });



  return router;
};