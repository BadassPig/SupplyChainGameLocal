'use strict'

// Game page from instructor's perspective
// This is a single page application.
var gameData = {
  submittedCounter : 0, // This is a counter
  numPlayers : 0,
  numRounds : 0,
  currentRound : 0,
  playerEmails : []
  };
var prevGameList = [];
var pageData = {
  instructorID  : '',
  showPrevGame : false,
  gameEnded : false // Button pressed and confirmed?
};

// DOM Ready =============================================================
$(document).ready(function() {
  var urlPath = window.location.pathname;
  pageData.instructorID = urlPath.replace('/instructorGamePage/', '');
  // Populate the user table on initial page load
  // At the begining client should fetch game data from server.
  getGameStatus(); // If a game has already begun, get game data.
  registerActions();
});

function registerActions() {
  $('#formSetupGame #btnStart').on('click', startGame);
  $('#formSetupGame #btnReset').on('click', resetGame);
  $('#formSetupGame #btnEnd').on('click', endGame);
  $('#btnNextRnd').on('click', nextRound);
  $('#btnCalc').on('click', calculate);
  $('#btnNextRnd').prop("disabled", true);
  $('#btnCalc').prop("disabled", true);
  $('#btnEnd').prop("disabled", true);
  $('#btnShowPrev').on('click', showPrevGameList);
  $('#prevGameListTable').hide();

  // Event source related
  var source = new EventSource('/game/stream');
  source.addEventListener('message', function(e) {
        if (!e)
          return ;
        var data = JSON.parse(e.data);
        var cr = gameData.serverGameData.currentRound;
        var player = data.player;
        var order = data.order;
        var counter = gameData.serverGameData.currentRound * gameData.numPlayers;
        $('#tdOrderId' + counter).html(order);
        gameData.submittedCounter ++;
        console.log('Submitted counter: ' + gameData.submittedCounter);
        console.log('num players : ' + gameData.numPlayers);
        enableNextRoundBtn(true);
      }, false);
  source.addEventListener('open', function(e) {
        console.log('EventSource connected');
      }, false);

  source.addEventListener('error', function(e) {
      if (e.target.readyState == EventSource.CLOSED) {
        console.log('EventSource disconnected.');
      }
      else if (e.target.readyState == EventSource.CONNECTING) {
        console.log('Connecting to EventSource.');
      }
    }, false);
};

function getGameStatus() {
  $.getJSON( '/game/instructorGetGameData', {instructor: pageData.instructorID}, function( data ) {
    gameData.serverGameData = data;
    if (data.playerList.length) {
      gameData.numPlayers = parseInt(gameData.serverGameData.numPlayer);
      gameData.numRounds = parseInt(gameData.serverGameData.numRound);
      //gameData.submittedCounter = gameData.numPlayers;
      gameData.currentRound = gameData.serverGameData.currentRound;
      if (gameData.currentRound > 0)
        $('#btnEnd').prop("disabled", false);
      $('#inputNumberOfGroups').val(gameData.numPlayers);
      $('#inputNumberOfRounds').val(gameData.numRounds);
      gameData.playerEmails = gameData.serverGameData.playerList;
      $('#inputPlayerEmails').val(gameData.serverGameData.playerList.join(';'));
      populateGameTable(gameData.serverGameData);
    }
  });
}

/*
 * Display content in game table
  @response game data
  @all boolean, display all data or just current round data 
 */
function populateGameTable(response, all) {
  var gameTableContent;
  //console.log(gameData);
  console.log(response.playerGameData);
  //var counter = response.currentRound * gameData.numPlayers;
  var counter = 0;
  for (var i = 0; i <= response.currentRound; ++ i) {
    $.each(response.playerGameData, function(index, value) {  // @index: playerID, @value: array of game data.
      //console.log('index2: ' + index2 + ', value2: ' + value2);
      // TODO: this could be optimized
        var playerGameDisp = value[i];
        //console.log(index + ': ' + playerGameDisp);
        gameTableContent += '<tr>';
        gameTableContent += '<td>' + i + '</td>'; // Round
        gameTableContent += '<td>' + response.playerList[index] + '</td>'; // Player
        gameTableContent += '<td>' + playerGameDisp.demand + '</td>'; // Demand
        var tdOrderId = counter ++;
        gameTableContent += '<td id="tdOrderId' + tdOrderId + '">' + playerGameDisp.order + '</td>';  // order
        gameTableContent += '<td>' + playerGameDisp.ration + '</td>'; // Ration
        gameTableContent += '<td>' + playerGameDisp.sales + '</td>';  // Sales
        gameTableContent += '<td>' + playerGameDisp.lostSales + '</td>';  // Lost Sales
        gameTableContent += '<td>' + playerGameDisp.surplusInv + '</td>';  // Surplus Inventory
        gameTableContent += '<td>' + playerGameDisp.profit + '</td>';  // profit
        gameTableContent += '<td>' + playerGameDisp.cumuProfit + '</td>'; // Cumulative Profit
        gameTableContent += '</tr>';
        if (i == response.currentRound && playerGameDisp.order)
          gameData.submittedCounter ++;
    });
  }

  $('#gameTable tbody').html(gameTableContent);
  //$('#gameTableBlock table tbody').append(gameTableContent);
  // Disable start game button.
  $('#formSetupGame #btnStart').prop('disabled', true);
  $('#inputNumberOfGroups').prop('disabled', true);
  $('#inputNumberOfRounds').prop('disabled', true);
  $('#selectAllocationRule').prop('disabled', true);
  $('#inputPlayerEmails').prop('disabled', true);
  enableNextRoundBtn();
};

function startGame(event) {
  event.preventDefault();

  var errCount = 0;
  // 
  $('#formSetupGame input').each(function(index, val) {
    if ($(this).attr('id') === 'inputPlayerEmails')
      return true; // skip checking this for now
    if($(this).val() === '' || $(this).val <= 0) { errCount ++; }
  });

  if (errCount === 0) {
    // Probably can do assignment while validating values so don't need to select DOM objects more than once
    gameData.numPlayers = $('#formSetupGame #inputNumberOfGroups').val();
    gameData.numRounds = $('#formSetupGame #inputNumberOfRounds').val();
    var emailStr = $('#inputPlayerEmails').val();
    // First truncate spaces
    emailStr = emailStr.replace(/\s+/g, '');
    $('#inputPlayerEmails').val(emailStr);
    if (emailStr !== '')
      gameData.playerEmails = emailStr.split(';');
    if (gameData.playerEmails.length != gameData.numPlayers) {
      alert('Number of e-mails ' + gameData.playerEmails.length + ' doesn\'t match number of players ' + gameData.numPlayers + '.');
      return ;
    }
    var newEmailsArray = [];
    gameData.playerEmails.forEach(function(e) {
      if (e.indexOf('@') == -1) {
        alert('Invalid e-mail ' + e);
        return ;
      }
      // Because Mongo DB doesn't allow '$' and '.' in keys, replace them with '_' when creating player names
      // ['$', '.'].map(c=>{
      //   while(e.indexOf(c) != -1) {
      //     let i = e.indexOf(c);
      //     e = e.substr(0, i) + '_' + e.substr(i + 1);
      //   }
      // });
      newEmailsArray.push(e);
    });
    gameData.playerEmails = newEmailsArray;
    //console.log(gameData);
    $.ajax({
            type: 'POST',
            data: gameData,
            url: '/game/startGame/' + pageData.instructorID,
            dataType: 'JSON'
        }).done(function( response ) {
          if (response.instructorRequestOk === true) {
            gameData.serverGameData = response;
            console.log("Game status ok by server.")
            console.log('Game ID: ' + response.gameID);
            populateGameTable(gameData.serverGameData);
            // Maybe this logic can be put somewhere else. This is only for first round
            $('#btnNextRnd').prop("disabled", false);
            //$('#btnCalc').prop("disabled", false);
            $('#btnEnd').prop("disabled", false);
          } else {
            alert(response.gameStartErr);
          }
        });
  } else {
    alert('Please fill fields with valid values.');
  }
};

function resetGame(event) {
  event.preventDefault();
  var r = confirm('Reset game will lose all current game data.');
  if (r === true) {
    console.log('Reset game button clicked.');
    $.ajax({
            type: 'POST',
            data: {},
            url: '/game/resetGame',
            dataType: 'JSON'
        }).done(function( response ) {
          if (response.instructorRequestOk === true) {
            window.location.reload();
          }
        });
  }
};

function endGame(event) {
  event.preventDefault();
  var confirmed = false;
  if (gameData.currentRound != gameData.numRounds) {
    var r = confirm('Game not finished, still end?');
    if (r)
      confirmed = true;
    else
      return ;
  }
  if (!confirmed)
    confirmed = confirm('End game and save game data?');
  if (confirmed === true) {
    $.ajax({
      type : 'POST',
      data : {},
      url: '/game/endGame/' + pageData.instructorID,
      dataType : 'JSON'
    }).done( function (response) {
      if (response.instructorRequestOk) {
        console.log('Game ended.');
        $('#btnNextRnd').prop("disabled", true);
        $('#btnCalc').prop("disabled", true);
        $('#btnEnd').prop("disabled", true);
      } else {
        alert('Save Game not successful.');
      }
    });
  }
};

function nextRound(event) {
  event.preventDefault();

  $.ajax({
        type: 'POST',
        data: {},
        url: '/game/nextRound',
        dataType: 'JSON'
    }).done(function( response ) {
      console.log('Next round successful.');
      gameData.currentRound ++;
      gameData.submittedCounter = 0;
      if (response.instructorRequestOk === true) {
        gameData.serverGameData = response;
        //gameData.serverGameData.currentRound ++;
        populateGameTable(gameData.serverGameData);
        $('#btnNextRnd').prop("disabled", true);
        $('#btnCalc').prop("disabled", true);
      } else {

      }
    });
};

function calculate(event) {
  event.preventDefault();

  $.ajax({
        type: 'POST',
        data: {},
        url: '/game/calculate',
        dataType: 'JSON'
    }).done(function( response ) {
      gameData.submittedCounter = 0;
      if (response.instructorRequestOk === true) {
        gameData.serverGameData = response;
        //gameData.serverGameData.currentRound ++;
        populateGameTable(gameData.serverGameData);
        if (gameData.serverGameData.currentRound < gameData.numRounds)
          $('#btnNextRnd').prop("disabled", false);
        $('#btnCalc').prop("disabled", true);
      } else {

      }
    });
};

function enableNextRoundBtn(eventSource) {  // @ eventSource function called from event source
  var cRnd = gameData.serverGameData.currentRound;
  if (gameData.submittedCounter >= gameData.numPlayers && cRnd <= gameData.numRounds) {
    if (eventSource)
      console.log('All players have submitted orders.');
    //$('#btnNextRnd').prop("disabled", cRnd == gameData.numRounds);
    if (gameData.numPlayers > 0 && !gameData.serverGameData.currentRoundCalculated)
      $('#btnCalc').prop("disabled", false);
  }
  if (cRnd == 0 && gameData.playerEmails.length)
    $('#btnNextRnd').prop('disabled', false);
};

function showPrevGameList(event) {
  event.preventDefault();
  if (pageData.showPrevGame) {
    $('#btnShowPrev').text("Show Game List");
    $('#prevGameListTable').hide();
  } else {
    $('#btnShowPrev').text("Hide Game List");
    $('#prevGameListTable').show();

    // Make JSON request to get live data every time the button is toggled.
    // Still trying to figure out if instructorID should be URL parameter or in JSON
    $.getJSON( '/game/getAllOldGame', {instructor: pageData.instructorID}, function( data ) {
      // Data will be an array of historical game info
      // Example: [{"Time":1489115942142,"NumPlayer":"2","NumPeriod":"2"},{"Time":1489118499196,"NumPlayer":"2","NumPeriod":"3"}]
      prevGameList = data;
      var prevGameTable;
      data.map(obj=>{
        prevGameTable += '<tr>';
        prevGameTable += '<td>' + (new Date(obj.Time)).toLocaleString() + '</td>';
        prevGameTable += '<td>' + obj.NumPlayer + '</td>';
        prevGameTable += '<td>' + obj.NumPeriod + '</td>';
        // You can do button drop down here as well.
        prevGameTable += '<td><select>' + '<option value="select">Select</option>' + '<option value="view">View</option>' + '<option value="delete">Delete</option>' + '</select></td>';
        prevGameTable += '</tr>';
      });
      $('#prevGameListTable tbody').html(prevGameTable);
      // Because prev game table is not populated till the actual show action takes place, select event can only be binded now.
      $('#prevGameListTable tbody select').on('change', function() {
        var sel = $(this).val();
        if (sel == 'select')
          return ;
        var row = $(this).parent().parent().index();  // First parent() gives you <td>, second parent() gives you <tr>
        var column = $(this).parent().index();
        var selectedGameId = prevGameList[row].Time;
        // Whenever user makes a selection, reset all other selections to 'select' (because we bind on 'change')
        $('#prevGameListTable select').val('select');
        $('#prevGameListTable tbody tr:eq(' + row + ') select').val(sel);
        if (sel == 'view') {
          $.getJSON('/game/getOldGameById', {gameID : selectedGameId, instructor : pageData.instructorID}, function(data) {
            //console.log(data);
            $('#btnNextRnd').prop("disabled", true);
            populateGameTable(data.GameData);
          });
        } else if (sel == 'delete') {
          var r = confirm('Do you want to remove this game? Removed game can\'t be recovered.');
          if (r) {
            $.ajax({
              type: 'DELETE',
              //data: {gameID : selectedGameId, instructor : pageData.instructorID},
              url: '/game/deleteGame/' + pageData.instructorID + '/' + selectedGameId
              //dataType: 'JSON'
            }).done( function (response) {
              console.log('Delete ' + selectedGameId + ' successful.');
              prevGameList.splice(row);
              // Repoulate game list
              populatePrevGameList(prevGameList);
            }).fail( function (jqXHR, textStatus) {
              console.log('Deleting game row ' + (row + 1) + ' failed: ' + textStatus);
            });
          } // if (r)
        }
      });
    });
  }
  pageData.showPrevGame = !pageData.showPrevGame;
}

function populatePrevGameList(data) {
  // data should be an array like [{"Time":1489115942142,"NumPlayer":"2","NumPeriod":"2"},{"Time":1489118499196,"NumPlayer":"2","NumPeriod":"3"}]
  var prevGameTable = '';
  data.map(obj=>{
    prevGameTable += '<tr>';
    prevGameTable += '<td>' + (new Date(obj.Time)).toLocaleString() + '</td>';
    prevGameTable += '<td>' + obj.NumPlayer + '</td>';
    prevGameTable += '<td>' + obj.NumPeriod + '</td>';
    // You can do button drop down here as well.
    prevGameTable += '<td><select>' + '<option value="select">Select</option>' + '<option value="view">View</option>' + '<option value="delete">Delete</option>' + '</select></td>';
    prevGameTable += '</tr>';
  });
  console.log('New game list content ' + prevGameTable);
  $('#prevGameListTable tbody').html(prevGameTable);
};