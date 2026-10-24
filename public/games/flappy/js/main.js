// Invitation adaptation, September 2026: local-only assets, telemetry removed, silent play, touch and responsive layout fixes. Original gameplay retained.
// New CSS artwork and text scores replace all original proprietary art and sound.
var debugmode = false;

var states = Object.freeze({
   SplashScreen: 0,
   GameScreen: 1,
   ScoreScreen: 2,
   DemoScreen: 3,
   PausedScreen: 4
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

var baseGap = Math.min(175, Math.max(105, flyArea * 0.46), flyArea * 0.68);
var pipeheight = baseGap;
var pipewidth = 52;
var pipes = new Array();

var replayclickable = false;
var selectedCharacter = null;
var characters = Object.freeze({ nova: 'Nova', pip: 'Pip', lumi: 'Lumi' });

// Silent invitation edition; original sound assets are not distributed.
//loops
var loopGameloop;
var previousFlightFrame = 0;
var flightStepMs = 1000 / 60;
var towerElapsedMs = 0;
var demoSeen = false;
var demoFrame;
var demoStartedAt = 0;
var demoStep = -1;
var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

$(document).ready(function() {
   if(window.location.search == "?debug")
      debugmode = true;
   if(window.location.search == "?easy")
      baseGap = Math.min(200, flyArea * 0.68);

   //get the highscore
   var savedscore = getCookie("highscore");
   if(savedscore != "")
      highscore = parseInt(savedscore);

   //start with the splash screen
   showSplash();
   window.invitationRegisterSession({ hasProgress: function() { return currentstate === states.GameScreen || currentstate === states.PausedScreen; }, pause: pauseFlight });
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
   document.getElementById('pause-flight').hidden = true;
   document.getElementById('flight-pause').hidden = true;
   stopDemo();
   currentstate = states.SplashScreen;

   //set the defaults (again)
   velocity = 0;
   position = Math.min(180, $("#flyarea").height() * 0.45);
   rotation = 0;
   score = 0;
   towerElapsedMs = 0;
   pipeheight = getDifficulty(0).gap;
   $("#difficulty-label").text('');

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
   if(selectedCharacter) {
      selectCharacter(selectedCharacter);
      document.getElementById('start-flight').focus({ preventScroll: true });
   }
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
   $("#start-flight").prop('disabled', false).text((demoSeen ? 'Fly with ' : 'Learn & fly with ') + characters[character] + ' ✦');
   $("#watch-demo").prop('disabled', false);
}

$(".character-option").on('click', function() { selectCharacter($(this).attr('data-character')); });
$("#start-flight").on('click', function() { if(demoSeen) startGame(); else showDemo(); });
$("#watch-demo").on('click', showDemo);
$("#demo-start").on('click', function() {
   if(currentstate !== states.DemoScreen) return;
   demoSeen = true;
   startGame();
});
$("#demo-back").on('click', function() {
   if(currentstate === states.DemoScreen) showSplash();
});

function showDemo()
{
   if(currentstate !== states.SplashScreen || !selectedCharacter) return;
   currentstate = states.DemoScreen;
   $("#splash").hide();
   document.getElementById('flight-demo').hidden = false;
   $("#demo-rider").attr('src', 'art/' + selectedCharacter + '.svg');
   $("#demo-start").text('Got it — fly with ' + characters[selectedCharacter] + ' ✦');
   demoStartedAt = performance.now();
   demoStep = -1;
   renderDemo(demoStartedAt);
   document.getElementById('demo-start').focus({ preventScroll: true });
}

function renderDemo(now)
{
   if(currentstate !== states.DemoScreen) return;
   var scene = document.getElementById('demo-scene');
   var elapsed = (now - demoStartedAt) % 6000;
   var phase = elapsed / 6000;
   var step = elapsed < 2000 ? 0 : elapsed < 4300 ? 1 : 2;
   // Reduced-motion visitors see three still poses with the same instructions.
   if(reducedMotion.matches) phase = [0.15, 0.55, 0.95][step];
   var rider = document.getElementById('demo-rider');
   var riderLeft = Math.min(42, scene.clientWidth * 0.18);
   var centre = (scene.clientHeight - rider.clientHeight) / 2;
   var y, angle;
   if(reducedMotion.matches) {
      y = centre + [-8, 5, 0][step];
      angle = 0;
   } else if(step === 0) {
      y = centre + 8 - 16 * Math.sin(elapsed / 2000 * Math.PI / 2);
      angle = -12 * Math.sin(elapsed / 2000 * Math.PI);
   } else if(step === 1) {
      var drift = (elapsed - 2000) / 2300;
      y = centre - 8 + 16 * Math.pow(drift, 1.5);
      angle = 15 * drift;
   } else {
      y = centre + 8 - 8 * Math.sin((elapsed - 4300) / 1700 * Math.PI / 2);
      angle = -8;
   }
   rider.style.left = riderLeft + 'px';
   rider.style.top = y + 'px';
   rider.style.transform = 'rotate(' + angle + 'deg)';
   var towerLeft = scene.clientWidth + 12 - phase * (scene.clientWidth + 75);
   document.querySelector('.demo-tower').style.left = towerLeft + 'px';
   $("#demo-tap").css('opacity', step === 0 ? 1 : 0.35);
   $("#demo-point").css({ opacity: towerLeft + 42 < riderLeft ? 1 : 0, left: Math.min(scene.clientWidth - 42, riderLeft + rider.clientWidth + 3) });
   if(step !== demoStep) {
      demoStep = step;
      $(".demo-steps li").removeClass('is-current').eq(step).addClass('is-current');
      $("#demo-tip").text(['A tap lifts your broomstick.', 'Ease off to drift down; tap again to rise.', 'Clear a tower to earn one point.'][step]);
   }
   demoFrame = requestAnimationFrame(renderDemo);
}

function stopDemo()
{
   cancelAnimationFrame(demoFrame);
   demoFrame = null;
   document.getElementById('flight-demo').hidden = true;
}

function startGame()
{
   if(!selectedCharacter || (currentstate !== states.SplashScreen && currentstate !== states.DemoScreen)) return;
   if(!demoSeen) { showDemo(); return; }
   stopDemo();
   currentstate = states.GameScreen;
   document.getElementById('pause-flight').hidden = false;

   $("#splash").hide();
   $("#player").css('visibility', 'visible');
   $("#rider-name").text(characters[selectedCharacter]);
   document.activeElement.blur();

   //update the big score
   setBigScore();
   updateDifficulty();

   //debug mode?
   if(debugmode)
   {
      //show the bounding boxes
      $(".boundingbox").show();
   }

   // Paint on display frames; keep flight speed consistent across refresh rates.
   previousFlightFrame = performance.now();
   loopGameloop = requestAnimationFrame(flightFrame);
   towerElapsedMs = 0;

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

function pauseFlight() {
   if(currentstate !== states.GameScreen) return;
   currentstate = states.PausedScreen;
   cancelAnimationFrame(loopGameloop);
   loopGameloop = null;
   document.getElementById('pause-flight').hidden = true;
   document.getElementById('flight-pause').hidden = false;
   document.getElementById('resume-flight').focus({ preventScroll: true });
}
function resumeFlight() {
   if(currentstate !== states.PausedScreen || document.hidden) return;
   document.getElementById('flight-pause').hidden = true;
   document.getElementById('pause-flight').hidden = false;
   currentstate = states.GameScreen;
   document.activeElement.blur();
   previousFlightFrame = performance.now();
   loopGameloop = requestAnimationFrame(flightFrame);
}
document.getElementById('pause-flight').addEventListener('click', pauseFlight);
document.getElementById('resume-flight').addEventListener('click', resumeFlight);
document.addEventListener('visibilitychange', function() { if(document.hidden) pauseFlight(); });
window.addEventListener('blur', pauseFlight);

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
   // Use the same elapsed flight time for every tower: score changes cannot
   // make a new tower catch an earlier one or make movement depend on width.
   var difficulty = getDifficulty(score);
   $('.pipe').each(function() {
      // Keep subpixel positions in numbers; repeatedly parsing CSS rounds the
      // distance differently on 60 Hz and 120 Hz displays.
      var left = this.flightLeft;
      if(this.lastPaintedLeft !== this.style.left) left = parseFloat(this.style.left);
      left -= difficulty.speed * steps * flightStepMs / 1000;
      this.flightLeft = left;
      this.style.left = left + 'px';
      this.lastPaintedLeft = this.style.left;
      if(left <= -100) $(this).remove();
   });
   towerElapsedMs += steps * flightStepMs;
   if(towerElapsedMs >= 1600) {
      towerElapsedMs -= 1600;
      updatePipes();
   }

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

   var pipetop = nextpipeupper.offset().top + nextpipeupper.outerHeight();
   var pipeleft = nextpipeupper.offset().left - 2; // for some reason it starts at the inner pipes offset, not the outer pipes.
   var piperight = pipeleft + pipewidth;
   // Keep each gap fixed after it appears, even when a point raises difficulty.
   var nextGap = Number(nextpipe.attr('data-gap'));
   var pipebottom = pipetop + nextGap;

   if(debugmode)
   {
      var boundingbox = $("#pipebox");
      boundingbox.css('left', pipeleft);
      boundingbox.css('top', pipetop);
      boundingbox.css('height', nextGap);
      boundingbox.css('width', pipewidth);
   }

   //have we gotten inside the pipe yet?
   if(boxright > pipeleft && boxleft < piperight)
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
   if(e.keyCode === 80 && !e.repeat) { e.preventDefault(); if(currentstate === states.PausedScreen) resumeFlight(); else pauseFlight(); return; }
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
   document.getElementById('pause-flight').hidden = true;
   document.getElementById('flight-pause').hidden = true;
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
   $("#difficulty-label").text('');

   //destroy our gameloops
   cancelAnimationFrame(loopGameloop);
   loopGameloop = null;
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

function playerScore()
{
   score += 1;
   //play score sound
   setBigScore();
   updateDifficulty();
}

function getDifficulty(points)
{
   var progress = Math.min(40, Math.max(0, points)) / 40;
   var minimumGap = Math.min(baseGap, Math.max(82, baseGap * 0.64));
   return { gap: baseGap - (baseGap - minimumGap) * progress, speed: 110 + 60 * progress };
}

function updateDifficulty()
{
   pipeheight = getDifficulty(score).gap;
   var label = score < 10 ? 'Gentle flight' : score < 20 ? 'Brisk flight' : score < 30 ? 'Swift flight' : 'Expert flight';
   if($("#difficulty-label").text() !== label) $("#difficulty-label").text(label);
}

function updatePipes()
{
   //Do any pipes need removal?
   $(".pipe").filter(function() { return $(this).position().left <= -100; }).remove()

   //add a new pipe (top height + bottom height  + pipeheight == flyArea) and put it in our tracker
   var gap = getDifficulty(score).gap;
   var padding = Math.min(80, (flyArea - gap) * 0.3);
   var constraint = flyArea - gap - (padding * 2); //double padding (for top and bottom)
   var topheight = Math.floor((Math.random()*constraint) + padding); //add lower padding
   // Adjacent gaps stay reachable; the maximum shift is smaller on short screens.
   var previous = pipes[pipes.length - 1];
   if(previous) {
      var previousCenter = previous.children('.pipe_upper').outerHeight() + Number(previous.attr('data-gap')) / 2;
      var shift = Math.min(65, flyArea * 0.2);
      topheight = Math.max(padding, Math.min(flyArea - gap - padding, Math.max(previousCenter - shift - gap / 2, Math.min(previousCenter + shift - gap / 2, topheight))));
   }
   var bottomheight = (flyArea - gap) - topheight;
   var newpipe = $('<div class="pipe animated" data-gap="' + gap + '" style="left: ' + ($("#flyarea").width() + 30) + 'px;"><div class="pipe_upper" style="height: ' + topheight + 'px;"></div><div class="pipe_lower" style="height: ' + bottomheight + 'px;"></div></div>');
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
