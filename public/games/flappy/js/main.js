// Invitation adaptation, September 2026: local-only assets, telemetry removed, silent play, touch and responsive layout fixes. Original gameplay retained.
// New CSS artwork and text scores replace all original proprietary art and sound.
var debugmode = false;

var states = Object.freeze({
   SplashScreen: 0,
   GameScreen: 1,
   ScoreScreen: 2
});

var currentstate;

var gravity = 0.25;
var velocity = 0;
var position = Math.min(180, $("#flyarea").height() * 0.45);
var rotation = 0;
var jump = -4.6;
var flyArea = $("#flyarea").height();

var score = 0;
var highscore = 0;

var pipeheight = Math.min(160, Math.max(90, flyArea * 0.4), flyArea * 0.65);
var pipewidth = 52;
var pipes = new Array();

var replayclickable = false;
var selectedCharacter = null;
var characters = Object.freeze({ nova: 'Nova', pip: 'Pip', lumi: 'Lumi' });

// Silent invitation edition; original sound assets are not distributed.
//loops
var loopGameloop;
var loopPipeloop;
var previousFlightFrame = 0;
var flightStepMs = 1000 / 60;

$(document).ready(function() {
   if(window.location.search == "?debug")
      debugmode = true;
   if(window.location.search == "?easy")
      pipeheight = 200;

   //get the highscore
   var savedscore = getCookie("highscore");
   if(savedscore != "")
      highscore = parseInt(savedscore);

   //start with the splash screen
   showSplash();
   window.invitationGameReady();
});

function getCookie(cname)
{
   var name = cname + "=";
   var ca = document.cookie.split(';');
   for(var i=0; i<ca.length; i++)
   {
      var c = ca[i].trim();
      if (c.indexOf(name)==0) return c.substring(name.length,c.length);
   }
   return "";
}

function setCookie(cname,cvalue,exdays)
{
   var d = new Date();
   d.setTime(d.getTime()+(exdays*24*60*60*1000));
   var expires = "expires="+d.toGMTString();
   document.cookie = cname + "=" + cvalue + "; " + expires;
}

function showSplash()
{
   currentstate = states.SplashScreen;

   //set the defaults (again)
   velocity = 0;
   position = Math.min(180, $("#flyarea").height() * 0.45);
   rotation = 0;
   score = 0;

   //update the player in preparation for the next game
   $("#player").css({ y: 0, x: 0 });
   updatePlayer($("#player"));

   //clear out all the pipes if there are any
   $(".pipe").remove();
   pipes = new Array();

   //make everything animated again
   $(".animated").css('animation-play-state', 'running');
   $(".animated").css('-webkit-animation-play-state', 'running');

   // Every replay returns to character selection, keeping the last choice.
   $("#player").css('visibility', 'hidden');
   $("#rider-name").text('');
   $("#splash").css('display', 'grid');
   if(selectedCharacter) document.getElementById('start-flight').focus({ preventScroll: true });
}

function selectCharacter(character)
{
   if(currentstate !== states.SplashScreen || !Object.prototype.hasOwnProperty.call(characters, character)) return;
   selectedCharacter = character;
   $(".character-option").each(function() {
      $(this).attr('aria-pressed', String($(this).attr('data-character') === character));
   });
   $("#player img").attr('src', 'art/' + character + '.svg');
   $("#player").attr('aria-label', characters[character] + ' on a broomstick');
   $("#selection-status").text(characters[character] + ' is ready for takeoff!');
   $("#start-flight").prop('disabled', false).text('Fly with ' + characters[character] + ' ✦');
}

$(".character-option").on('click', function() { selectCharacter($(this).attr('data-character')); });
$("#start-flight").on('click', startGame);

function startGame()
{
   if(currentstate !== states.SplashScreen || !selectedCharacter) return;
   currentstate = states.GameScreen;

   $("#splash").hide();
   $("#player").css('visibility', 'visible');
   $("#rider-name").text(characters[selectedCharacter]);
   document.activeElement.blur();

   //update the big score
   setBigScore();

   //debug mode?
   if(debugmode)
   {
      //show the bounding boxes
      $(".boundingbox").show();
   }

   // Paint on display frames; keep flight speed consistent across refresh rates.
   previousFlightFrame = performance.now();
   loopGameloop = requestAnimationFrame(flightFrame);
   loopPipeloop = setInterval(updatePipes, 1400);

   //jump from the start!
   playerJump();
}

function flightFrame(now)
{
   if(currentstate !== states.GameScreen) return;
   // Avoid a large jump if the browser stalls or the tab was in the background.
   var steps = Math.min(2, Math.max(0, (now - previousFlightFrame) / flightStepMs));
   previousFlightFrame = now;
   gameloop(steps);
   if(currentstate === states.GameScreen)
      loopGameloop = requestAnimationFrame(flightFrame);
}

function updatePlayer(player, steps = 1)
{
   // Lift responds immediately, while the nose eases through the turn. The
   // exponential response takes the same time on 60 Hz and faster displays.
   var targetRotation = Math.min((velocity / 10) * 90, 90);
   var turnResponse = 1 - Math.exp(-steps * flightStepMs / 90);
   rotation += (targetRotation - rotation) * turnResponse;

   //apply rotation and position
   $(player).css({ rotate: rotation, top: position });
}

function gameloop(steps = 1) {
   var player = $("#player");

   //update the player speed/position
   // Integrate the original 60 Hz flight curve over the elapsed frame time.
   position += velocity * steps + gravity * steps * (steps + 1) / 2;
   velocity += gravity * steps;

   //update the player
   updatePlayer(player, steps);

   //create the bounding box
   var box = document.getElementById('player').getBoundingClientRect();
   var origwidth = player.width();
   var origheight = player.height();

   var boxwidth = origwidth - (Math.sin(Math.abs(rotation) / 90) * 8);
   var boxheight = (origheight + box.height) / 2;
   var boxleft = ((box.width - boxwidth) / 2) + box.left;
   var boxtop = ((box.height - boxheight) / 2) + box.top;
   var boxright = boxleft + boxwidth;
   var boxbottom = boxtop + boxheight;

   //if we're in debug mode, draw the bounding box
   if(debugmode)
   {
      var boundingbox = $("#playerbox");
      boundingbox.css('left', boxleft);
      boundingbox.css('top', boxtop);
      boundingbox.css('height', boxheight);
      boundingbox.css('width', boxwidth);
   }

   //did we hit the ground?
   if(box.bottom >= $("#land").offset().top)
   {
      playerDead();
      return;
   }

   //have they tried to escape through the ceiling? :o
   var ceiling = $("#ceiling");
   if(boxtop <= (ceiling.offset().top + ceiling.height()))
      position = 0;

   //we can't go any further without a pipe
   if(pipes[0] == null)
      return;

   //determine the bounding box of the next pipes inner area
   var nextpipe = pipes[0];
   var nextpipeupper = nextpipe.children(".pipe_upper");

   var pipetop = nextpipeupper.offset().top + nextpipeupper.height();
   var pipeleft = nextpipeupper.offset().left - 2; // for some reason it starts at the inner pipes offset, not the outer pipes.
   var piperight = pipeleft + pipewidth;
   var pipebottom = pipetop + pipeheight;

   if(debugmode)
   {
      var boundingbox = $("#pipebox");
      boundingbox.css('left', pipeleft);
      boundingbox.css('top', pipetop);
      boundingbox.css('height', pipeheight);
      boundingbox.css('width', pipewidth);
   }

   //have we gotten inside the pipe yet?
   if(boxright > pipeleft)
   {
      //we're within the pipe, have we passed between upper and lower pipes?
      if(boxtop > pipetop && boxbottom < pipebottom)
      {
         //yeah! we're within bounds

      }
      else
      {
         //no! we touched the pipe
         playerDead();
         return;
      }
   }


   //have we passed the imminent danger?
   if(boxleft > piperight)
   {
      //yes, remove it
      pipes.splice(0, 1);

      //and score a point
      playerScore();
   }
}

//Handle space bar
$(document).keydown(function(e){
   // Let native buttons handle Space/Enter while choosing or sharing.
   if($(e.target).closest('button').length) return;
   //space bar!
   if(e.keyCode == 32)
   {
      e.preventDefault();
      // Space returns to selection after a flight; takeoff uses its own button.
      if(currentstate == states.ScoreScreen)
         $("#replay").click();
      else
         screenClick();
   }
});

// Unified touch/mouse input avoids synthetic double taps.
$("#flyarea").on("pointerdown", function(event) {
   if(currentstate !== states.GameScreen || $(event.target).closest('button').length) return;
   event.preventDefault();
   screenClick();
});

function screenClick()
{
   if(currentstate == states.GameScreen)
   {
      playerJump();
   }
}

function playerJump()
{
   velocity = jump;
   //play jump sound
}

function setBigScore(erase)
{
   var elemscore = $("#bigscore");
   elemscore.empty();

   if(erase)
      return;

   elemscore.text(score);
}

function setSmallScore()
{
   var elemscore = $("#currentscore");
   elemscore.empty();

   elemscore.text(score);
}

function setHighScore()
{
   var elemscore = $("#highscore");
   elemscore.empty();

   elemscore.text(highscore);
}

function setMedal()
{
   var elemmedal = $("#medal");
   elemmedal.empty();

   if(score < 10)
      //signal that no medal has been won
      return false;

   if(score >= 10)
      medal = "bronze";
   if(score >= 20)
      medal = "silver";
   if(score >= 30)
      medal = "gold";
   if(score >= 40)
      medal = "platinum";

   elemmedal.text('★').attr('aria-label', medal + ' medal');

   //signal that a medal has been won
   return true;
}

function playerDead()
{
   //stop animating everything!
   $(".animated").css('animation-play-state', 'paused');
   $(".animated").css('-webkit-animation-play-state', 'paused');

   // Bring the broomstick rider down to the grounds.
   var playerbottom = $("#player").position().top + $("#player").width(); //we use width because he'll be rotated 90 deg
   var floor = flyArea;
   var movey = Math.max(0, floor - playerbottom);
   $("#player").transition({ y: movey + 'px', rotate: 90}, 1000, 'easeInOutCubic');

   //it's time to change states. as of now we're considered ScoreScreen to disable left click/flying
   currentstate = states.ScoreScreen;

   //destroy our gameloops
   cancelAnimationFrame(loopGameloop);
   clearInterval(loopPipeloop);
   loopGameloop = null;
   loopPipeloop = null;
   showScore();
}

function showScore()
{
   //unhide us
   $("#scoreboard").css("display", "block");

   //remove the big score
   setBigScore(true);

   //have they beaten their high score?
   if(score > highscore)
   {
      //yeah!
      highscore = score;
      //save it!
      setCookie("highscore", highscore, 999);
   }

   //update the scoreboard
   $("#result-character").text('Flown with ' + characters[selectedCharacter]);
   setSmallScore();
   setHighScore();
   var wonmedal = setMedal();

   //SWOOSH!

   //show the scoreboard
   $("#scoreboard").css({ y: '40px', opacity: 0 }); //move it down so we can slide it up
   $("#replay").css({ y: '40px', opacity: 0 });
   $("#scoreboard").transition({ y: '0px', opacity: 1}, 600, 'ease', function() {
      //When the animation is done, animate in the replay button and SWOOSH!
      $("#replay").transition({ y: '0px', opacity: 1}, 600, 'ease');

      //also animate in the MEDAL! WOO!
      if(wonmedal)
      {
         $("#medal").css({ scale: 2, opacity: 0 });
         $("#medal").transition({ opacity: 1, scale: 1 }, 1200, 'ease');
      }
   });

   //make the replay button clickable
   replayclickable = true;
}

$("#replay").click(function() {
   //make sure we can only click once
   if(!replayclickable)
      return;
   else
      replayclickable = false;
   //SWOOSH!

   //fade out the scoreboard
   $("#scoreboard").transition({ y: '-40px', opacity: 0}, 1000, 'ease', function() {
      //when that's done, display us back to nothing
      $("#scoreboard").css("display", "none");

      //start the game over!
      showSplash();
   });
});

document.getElementById('share-final-score').addEventListener('click', function(event) {
   event.stopPropagation();
   if (currentstate !== states.ScoreScreen || !replayclickable) return;
   window.invitationShareResult({ score: score, best: highscore, character: selectedCharacter });
});

function playerScore()
{
   score += 1;
   //play score sound
   setBigScore();
}

function updatePipes()
{
   //Do any pipes need removal?
   $(".pipe").filter(function() { return $(this).position().left <= -100; }).remove()

   //add a new pipe (top height + bottom height  + pipeheight == flyArea) and put it in our tracker
   var padding = Math.min(80, (flyArea - pipeheight) * 0.3);
   var constraint = flyArea - pipeheight - (padding * 2); //double padding (for top and bottom)
   var topheight = Math.floor((Math.random()*constraint) + padding); //add lower padding
   var bottomheight = (flyArea - pipeheight) - topheight;
   var newpipe = $('<div class="pipe animated"><div class="pipe_upper" style="height: ' + topheight + 'px;"></div><div class="pipe_lower" style="height: ' + bottomheight + 'px;"></div></div>');
   $("#flyarea").append(newpipe);
   pipes.push(newpipe);
}

var isIncompatible = {
   Android: function() {
   return navigator.userAgent.match(/Android/i);
   },
   BlackBerry: function() {
   return navigator.userAgent.match(/BlackBerry/i);
   },
   iOS: function() {
   return navigator.userAgent.match(/iPhone|iPad|iPod/i);
   },
   Opera: function() {
   return navigator.userAgent.match(/Opera Mini/i);
   },
   Safari: function() {
   return (navigator.userAgent.match(/OS X.*Safari/) && ! navigator.userAgent.match(/Chrome/));
   },
   Windows: function() {
   return navigator.userAgent.match(/IEMobile/i);
   },
   any: function() {
   return (isIncompatible.Android() || isIncompatible.BlackBerry() || isIncompatible.iOS() || isIncompatible.Opera() || isIncompatible.Safari() || isIncompatible.Windows());
   }
};
