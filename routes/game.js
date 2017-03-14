// This is the server side (more like expressjs) javascript. This file is not run on client side. It handles request from both instructor and player
// For now only consider single instructor session.

// TODO
// Make game data per instructor
// When game ends, save game data to DB
// The way of creating multiple players is a bit naive, it's going to be more complicated when multiple instructor plays the game simutaneously
// SSE is also going to get complicated for multi-instructor case.


var express = require('express');
var router = express.Router();
var SSE = require('express-sse');
var sse = new SSE();	// SSE connection for instructor
var ssePlayer = new SSE(); // sse connection for player.
var passport = require('passport');


// Data structure for the game.
// Not saving per instructor game data at this point.
var serverGameStatus = {
  gameID : 0,
  numPlayer: 0, 
	numRound: 0,
	currentRound: 0,
  currentRoundCalculated : false,
	instructorRequestOk: false,
	playerList: [],
	playerGameData: {},	// playerName : [round Data]. [round data] is an array of objects
  setPlayerOrder(player, order, round) {  // set the order for player
    var currentRound = !round ? this.currentRound : round;
    if (!this.playerGameData.hasOwnProperty(player) || this.playerGameData[player].length < currentRound)
      return ;
    (this.playerGameData[player])[currentRound].order = order;
  },
  clear() { // There might be a better way in JS to do this.
    this.gameID = 0;
    this.numPlayer = 0;
    this.numRound = 0;
    this.currentRound = 0;
    this.currentRoundCalculated = false;
    this.instructorRequestOk = false;
    this.playerList = [];
    this.playerGameData = {};
  }
};	// keep a record at server. In the future this should be per session.

var gameParam = {
  totalSupply : 20,
  salePrice : 10,
  cost : 2,
  getProfit : function () {
    return this.salePrice - this.cost;
  }
};

function clearServerGameStatus() {
  serverGameStatus.clear();
}

// Save current game data to DB
function saveServerGameStatus(req) {
  var instructor = req.params.instructorID;
  var dbGameTable = req.db.get('gameData');
  var query = {
    Time        : serverGameStatus.gameID,
    Instructor  : instructor
  };
  if (dbGameTable.count(query) > 0) {
    console.log('Game for instructor ' + instructor + ' at time ' + (new Date(serverGameStatus.gameID)) + ' already exists, override.');
    dbGameTable.remove(query);
  }
  dbGameTable.insert( {
    Time        : serverGameStatus.gameID,
    Instructor  : instructor,
    NumPlayer   : serverGameStatus.numPlayer,
    NumPeriod   : serverGameStatus.numRound,
    GameData    : serverGameStatus},
    function (err, result) {
      if (err)
        console.log(err);
    });
}

/*
 * Instructor HTTP request handle START
 */

/*
 * Get game data. In case instructor refresh page during the game.
 */
 router.get('/instructorGetGameData', function(req, res){
  // Request sent using $.getJSON(), where data is appended to URL as a query string
  //console.log('Instructor ' + req.query.instructor + ' just requested game data.');
  res.send(serverGameStatus);
 });

 router.get('/stream', sse.init);

 router.get('/getAllOldGame', function(req, res) {
  var instructor = req.query.instructor;
  var dbGameTable = req.db.get('gameData');
  var query = {
    Instructor  : instructor
  };
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
      console.log('Old game data for ' + instructor + ' not found.');
    }
  });
 });

 router.get('/getOldGameById', function(req, res) {
  var gameId = req.query.gameID;
  var instructor = req.query.instructor;
  console.log('Instructor ' + instructor + ' just requested old game ' + gameId);
  var dbGameTable = req.db.get('gameData');
  dbGameTable.find({Time : parseInt(gameId), Instructor : instructor })
  .then(docs=>{
    if (docs) {  // Should be unique
      res.send(docs[0]);
    }
  });
 });

/*
 * POST to start game.
 */
router.post('/startGame', function(req, res) {
    //var db = req.db;
    //console.log('Received game start request.');
    clearServerGameStatus();
    serverGameStatus.numPlayer = req.body.numPlayers;
    serverGameStatus.numRound = req.body.numRounds;
    //serverGameStatus.playerList = [];
    for (var i = 1; i <= serverGameStatus.numPlayer; ++ i) {
    	serverGameStatus.playerList.push('testPlayer' + i);
    	serverGameStatus.playerGameData['testPlayer' + i] = [];
    }
    serverGameStatus.instructorRequestOk = true;
    serverGameStatus.gameID = (new Date()).getTime();
    gameGen(serverGameStatus);
    //console.log(serverGameStatus);

    //res.gameStartOk = true;
    //res.playerNames = serverGameStatus.playerList;
    // TODO: think about what need to be echoed back.
    res.send(serverGameStatus);
    ssePlayer.send(serverGameStatus.playerGameData);
});

router.post('/resetGame', function(req, res) {
	console.log('Game data reset.');
	clearServerGameStatus();
	res.send({instructorRequestOk: true});
});

router.post('/endGame/:instructorID', function(req, res) {
  console.log('End game requested.');
  saveServerGameStatus(req);
  clearServerGameStatus();
  res.send({instructorRequestOk: true});
});

/*
 * POST to go to next round.
 */
router.post('/nextRound', function(req, res) {
	serverGameStatus.currentRound ++;
	gameGen(serverGameStatus);
  res.send(serverGameStatus);
  ssePlayer.send(serverGameStatus.playerGameData);
});

/*
 * POST to calculate per round result.
 */
router.post('/calculate', function(req, res) {
  calcGameData(serverGameStatus);
  res.send(serverGameStatus);
  ssePlayer.send(serverGameStatus.playerGameData);
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

/*
 * Instructor HTTP request handle END
 */

/*
* Player HTTP request handle START
*/

router.get('/getPlayerTable/:player', function(req, res) {
	var player = req.params.player;
	console.log('Player ' + player + ' just requested game table.');
	if (serverGameStatus.playerGameData.hasOwnProperty(player)) {
    // console.log('Sending data: ');
    // console.log(serverGameStatus.playerGameData[player]);
		res.send(serverGameStatus.playerGameData[player]);
	}
	else {
		// Need to handle error correctl
		throw 'No record in playerGameData for ' + player;
	}
});

router.get('/ssePlayerGameData', ssePlayer.init);

// authenticate user request.
// This probably should happen in middleware.
// router.get('/getPlayerTable/:player', passport.authenticate('local'), function(req, res) {
// 	var player = req.params.player;
// 	console.log('Player ' + player + ' just requested game table.');
// 	if (serverGameStatus.playerGameData.hasOwnProperty(player)) {
// 		//console.log('Sending data: ' + serverGameStatus.playerGameData[player]);
// 		res.send(serverGameStatus.playerGameData[player]);
// 	}
// 	else {
// 		// Need to handle error correctly
// 		throw 'No record in playerGameData for ' + player;
// 	}
// });

router.post('/submitOrder/:player', function(req, res) {
  var player = req.params.player;
  var order = req.body.newOrder;
  console.log('Received order ' + order + ' from ' + player);
  var thisPlayerData = serverGameStatus.playerGameData[player];
  thisPlayerData[serverGameStatus.currentRound].order = order;
  serverGameStatus.setPlayerOrder(player, order);
  sse.send({player: player, order: order}, 'message');
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

/*
 * Game number generator, this is at the beginning of round
 */
 function gameGen(serverGameStatus) {
  //console.log('In gameGen()');
  var isDemoRound = serverGameStatus.currentRound === 0;
  serverGameStatus.currentRoundCalculated = isDemoRound;
  for (var player in serverGameStatus.playerGameData) {
    serverGameStatus.playerGameData[player].push({
              //demand: isDemoRound ? 8.59 : parseFloat(getRandNum()),  // toFixed returns a string
              demand: isDemoRound ? 8.59 : '',  // toFixed returns a string
              ration: isDemoRound ? 12.5 : '',
              sales: isDemoRound ? 8.59 : '',
              lostSales: isDemoRound ? '0.00' : '',
              surplusInv: isDemoRound ? 3.91 : '',
              profit: isDemoRound ? 60.90 : '',
              cumuProfit: isDemoRound ? 60.90 : '',
              order: isDemoRound ? 12.5 : ''});
  }
 };

 /*
  * Calculate game data after all players have submitted orders.
  */
function calcGameData(serverGameStatus) {
  console.log('--- calcGameData ---');
  var c = serverGameStatus.currentRound;
  var totalOrd = 0;
  for (var player in serverGameStatus.playerGameData) {
    if (serverGameStatus.playerGameData.hasOwnProperty(player)) {
      var pOrder = parseFloat((serverGameStatus.playerGameData[player])[c].order);
      totalOrd += pOrder;
    }
  }
  console.log('Total orders from all players: ' + totalOrd);
  for (var player in serverGameStatus.playerGameData) {
    if (serverGameStatus.playerGameData.hasOwnProperty(player)) {
      var pD = (serverGameStatus.playerGameData[player])[c]; // Player Order Data for player for round c
      var pDorder = parseFloat(pD.order);
      pD.demand = parseFloat(getRandNum());
      pD.ration = parseFloat((gameParam.totalSupply * pDorder / totalOrd).toFixed(2));
      pD.sales = Math.min(parseFloat(pD.demand), parseFloat(pD.ration));
      pD.lostSales = Math.max(pD.demand - pD.ration, 0).toFixed(2);
      pD.surplusInv = parseFloat(Math.max(pD.ration - pD.demand, 0).toFixed(2));
      pD.profit = parseFloat((pD.sales * gameParam.getProfit() - pD.surplusInv * gameParam.cost).toFixed(2));
      if (c - 1 >= 0)
        pD.cumuProfit = (parseFloat((serverGameStatus.playerGameData[player])[c - 1].cumuProfit) + pD.profit).toFixed(2);
    }
  }
  serverGameStatus.currentRoundCalculated = true;
};

module.exports = router;