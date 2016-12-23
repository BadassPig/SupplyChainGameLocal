// This is the server side (more like expressjs) javascript. This file is not run on client side

var express = require('express');
var router = express.Router();
var SSE = require('express-sse');
var sse = new SSE();	// instructor
var ssePlayer = new SSE(); // sse connection for player.
var passport = require('passport');

var serverGameStatus = {
  numPlayer: 0, 
	numRound: 0,
	currentRound: 0,
	instructorRequestOk: false,
	playerList: [], 
	playerGameData: {},	// playerName : [round Data]
  setPlayerOrder(player, order, round) {
    var currentRound = !round ? this.currentRound : round;
    if (!this.playerGameData.hasOwnProperty(player))
      return ;
    if (this.playerGameData[player].length < currentRound)
      return ;
    //console.log((this.playerGameData[player])[currentRound]);
    (this.playerGameData[player])[currentRound].order = order;
  }
};	// keep a record at server. In the future this should be per session.

function clearServerGameStatus() {
	serverGameStatus.numPlayer = 0;
	serverGameStatus.numRound = 0;
	serverGameStatus.currentRound = 0;
	serverGameStatus.playerList = [];
	serverGameStatus.playerGameData = {};
}

/*
 * POST to start game.
 */
 // In the future might want to distinguish by session ids rather than instructor ids.
router.post('/startGame', function(req, res) {
    //var db = req.db;
    //console.log('Received game start request.');
    // TODO: 1. record this game 2. ACK back client (instructor game page)
    // 3. There should be a list of players, server should communicate with them as well.
    clearServerGameStatus();
    serverGameStatus.numPlayer = req.body.numPlayers;
    serverGameStatus.numRound = req.body.numRounds;
    //serverGameStatus.playerList = [];
    for (var i = 1; i <= serverGameStatus.numPlayer; ++ i) {
    	serverGameStatus.playerList.push('testPlayer' + i);
    	serverGameStatus.playerGameData['testPlayer' + i] = [];
    }
    serverGameStatus.instructorRequestOk = true;
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

/*
 * Game number generator
 */
 function gameGen(serverGameStatus) {
 	//console.log('In gameGen()');
 	for (var player in serverGameStatus.playerGameData) {
 		serverGameStatus.playerGameData[player].push({supply: 200, cost: 10.0, order: serverGameStatus.currentRound === 0 ? 50 : ''});
 	}
 };

/*
 * POST to go to next round.
 */
router.post('/nextRound', function(req, res) {
	serverGameStatus.currentRound ++;
	gameGen(serverGameStatus);
  res.send(serverGameStatus);
  ssePlayer.send(serverGameStatus.playerGameData);
});

router.get('/getPlayerTable/:player', function(req, res) {
	var player = req.params.player;
	console.log('Player ' + player + ' just requested game table.');
	if (serverGameStatus.playerGameData.hasOwnProperty(player)) {
		console.log('Sending data: ');
    console.log(serverGameStatus.playerGameData[player]);
		res.send(serverGameStatus.playerGameData[player]);
	}
	else {
		// Need to handle error correctly
		throw 'No record in playerGameData for ' + player;
	}
});

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

router.get('/stream', sse.init);

router.get('/ssePlayerGameData', ssePlayer.init);

module.exports = router;