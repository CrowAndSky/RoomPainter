/* ####### GLOBAL VARIABLES ####### */
//console.log("this.width: " + this.width + "   this.height: " + this.height + "   this.posLeft: " + this.posLeft +"    this.posTop: " + this.posTop);
//console.log("waitingDrop: " + waitingDrop + "   learnedUI: " + learnedUI + "   learningSteps: " + learningSteps);
var roomImage,
pathGroup,
SVGpaths,
SVGscale,
theSwatches,
roomImages,
roomImage,
loadingOverlay,
simpleScale,
currentSwatch,
currentColor,
currentRow,
currentColumn,
surfaceIndex = '';
var colorSpaces = [];
var currentRow = 1;
var currentColumn = 4;
var renderCanvases = [];
var screenWidth = 0;
var imageWidth = 0;

var waitingDrop = true,
// waitingSwipe = false,
// waitingTap = false,
learnedUI = false,
learningSteps = 0;

var renderColor = [50,50,50];
var deviceTouch = false;
var loadingApp = true;
var displayLoading = true;

function modeArray(array) {
    if(array.length == 0)
        return null;
    var modeMap = {};
    var maxCount = 1, modes = [array[0]];
    for(var i = 0; i < array.length; i++)
    {
        var el = array[i];
        if(modeMap[el] == null)
            modeMap[el] = 1;
        else
            modeMap[el]++;  
        if(modeMap[el] > maxCount)
        {
            modes = [el];
            maxCount = modeMap[el];
        }
        else if(modeMap[el] == maxCount)
        {
            modes.push(el);
            maxCount = modeMap[el];
        }
    }
    return modes;
}

function RenderCanvas(destinationCanvas, sourceImage) {
    var that = this;
    this.valueData = {};
    this.colorsAll = [];
    this.colorsSorted = [];
    this.alphaCorrections = [];
    this.averageValue;
    this.image = sourceImage.get(0);
    this.canvas = destinationCanvas.get(0);
    this.context = this.canvas.getContext("2d");
    this.context.drawImage(this.image, 0, 0);
    this.width = destinationCanvas.width();
    this.height = destinationCanvas.height();
    this.posLeft = destinationCanvas.position().left;
    this.posTop = destinationCanvas.position().top;
    this.imageData = this.context.getImageData(0, 0, this.width, this.height);
    this.pixelData = this.imageData.data;
    this.renderMap = [];
    this.renderedPixels = [];
    this.pixelBuffer = new Int32Array(this.imageData.data.buffer);

    this.makeDiffMap = function(){
        var j = 0; //index in the array of all pixels
        var k = 0; //index in the array of all non-transparent pixels
        var l = 0; //index in the array of all semi-transparent pixels
        var pixLength = this.pixelData.length;
        for (var i = 0; i < pixLength; i += 4) {
            if (this.pixelData[i+3] > 15) {
                this.colorsSorted[k] = (this.pixelData[i] + this.pixelData[i+1] + this.pixelData[i+2]) / 3;
                this.renderedPixels[k] = {hue : this.pixelData[i], //source is grayscale so we use the red channel for the hue, which is the index of the tinted color lookup array
                                        index: j}; //index in the 32 bit array of all canvas pixels
                if (this.pixelData[i+3] < 250) {
                    this.alphaCorrections[l] = {alpha : this.pixelData[i+3], //alpha value of all semi-transparent pixels
                                        index: i+3}; //alpha index in the array of all semi-transparent pixels
                    l++;
                }
                k++;
            }
            j++;
        }
        this.averageValue = modeArray(this.colorsSorted);
        for (var i = 0; i < 256; i++) {
            this.renderMap[i] = {valueDiff : i - this.averageValue};
        }
        $(this.canvas).removeClass("hidden");
    }

    this.tintSurface = function (tintHue){
        if (!displayLoading) {
            $('body').addClass('displayLoading');
            displayLoading = true;
        }
        var rChannel, bChannel, gChannel;
        for (var i = 0; i < 256; i++) {
            rChannel = Math.min(251, Math.max(0, renderColor[0] + this.renderMap[i].valueDiff));
            gChannel = Math.min(251, Math.max(0, renderColor[1] + this.renderMap[i].valueDiff));
            bChannel = Math.min(251, Math.max(0, renderColor[2] + this.renderMap[i].valueDiff));
            this.renderMap[i].currentColor = (255   << 24) |    // alpha
                (bChannel << 16) |    // blue
                (gChannel <<  8) |    // green
                rChannel;
        }
        var rendPixLength = this.renderedPixels.length;
        for (var i = 0; i < rendPixLength; i++) {
            this.pixelBuffer[this.renderedPixels[i].index] = this.renderMap[this.renderedPixels[i].hue].currentColor;
        }
        this.context.putImageData(this.imageData, 0, 0);

        var alphaLength = this.alphaCorrections.length;
        for (var i = 0; i < alphaLength; i++) {
            this.pixelData[this.alphaCorrections[i].index] = this.alphaCorrections[i].alpha;
        }
        this.context.putImageData(this.imageData, 0, 0);

        if (displayLoading) {
            $('body').removeClass('displayLoading');
            displayLoading = false;
        }
    }
}

function setRenderColor(colorCurrent) {
    loadingOverlay.css('backgroundColor',colorCurrent);
    var matchColors = /rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)/;
    var match = matchColors.exec(colorCurrent);
    renderColor[0] =  parseInt(match[1]);
    renderColor[1] =  parseInt(match[2]);
    renderColor[2] =  parseInt(match[3]);
}

function initApp() {
    //console.log("waitingDrop: " + waitingDrop + "   learnedUI: " + learnedUI + "   learningSteps: " + learningSteps);
    roomImage = $('#sceneImage');
    pathGroup = $(".pathGroup");
    SVGpaths = $(".pathGroup path, .pathGroup polygon");
    canvasElems = $('canvas[data-element_index]');
    theSwatches = $('#swatches');
    roomImages = $('#roomScene img[data-surface_element]');
    loadingOverlay = $('#loadingOverlay');

    var resizedWidth;
    if (Modernizr.mq('only screen and (max-width: 767px)')) {
        resizedWidth = 0;
    } else if (Modernizr.mq('only screen and (max-width: 1023px)')) {
        resizedWidth = 1;
    } else if (Modernizr.mq('only screen and (max-width: 1239px)')) {
        resizedWidth = 2;
    } else {
        resizedWidth = 3;
    }
    roomImage.attr("src", "./images/room-surfaces/livingroom" + "-" + resizedWidth + ".jpg");
    roomImages.each(function(){
        $(this).attr("src", "./images/room-surfaces/" + $(this).attr('id') + "-" + resizedWidth + ".png");
    });

    roomImages.load(function() {
        var x = 1;
        canvasElems.each(function(){
            surfaceIndex = $(this).data('element_index');
            renderCanvases[x] = new RenderCanvas($(this),$('img[data-element_index="' + surfaceIndex + '"]'));
            $(renderCanvases[x].canvas).attr('width',$(this).width());
            $(renderCanvases[x].canvas).attr('height',$(this).height());
            renderCanvases[x].makeDiffMap();
            x++;
        });
    });

    for (var x = 0; x < 8; x++) {
        colorSpaces[x] = [];
        for (var y = 0; y < 10; y++) {
            var currentColor = theSwatches.find('div').eq(x * 10 + y).css('backgroundColor');
            var matchColors = /rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)/;
            var match = matchColors.exec(currentColor);
            colorSpaces[x][y] = {r:parseInt(match[1]),g:parseInt(match[2]),b:parseInt(match[3])};
        }
    }

    if (deviceTouch){
        $('body').addClass('waitingTap');
        var hammerSwatches = $('#swatches').hammer();
        var hammerSVGelems = $(SVGpaths).hammer();

        document.ontouchmove = function(event){
            event.preventDefault();
        }

        hammerSwatches.on("tap", "div", function(event) {
            if (!waitingDrop) {
                currentColor = $(this).css('backgroundColor');
                setRenderColor(currentColor);
                currentRow = $(this).data('row_id');
                currentColumn = $(this).data('column_id');
                $('canvas[data-surface_element="' + surfaceIndex + '"]').each(function(){
                    renderCanvases[$(this).data('element_index')].tintSurface();
                    renderCanvases[$(this).data('element_index')].colorSpaceRow = currentRow;
                    renderCanvases[$(this).data('element_index')].colorSpaceColumn = currentColumn;
                });
                waitingDrop = true;
                $('body').removeClass('expanded');

            }
        });

        hammerSVGelems.on("tap", function(event) {
            if (waitingDrop) {
                surfaceIndex = $(this).data('surface_element');
                $('body').addClass('expanded');
                waitingDrop = false;

                if (!learnedUI) {
                    if (learningSteps < 3) {
                        $('body').removeClass('waitingTap');
                        learningSteps++;
                    } else if (learningSteps < 6) {
                        $('body').addClass('waitingSwipe');
                        learningSteps++;
                    } else {
                        $('body').removeClass('waitingSwipe');
                        learnedUI = true;
                    }
                }
            }
        });

        hammerSVGelems.on("swipe", function(event) {
            var swipeDirection = event.gesture.direction;
            if (!learnedUI) {
                $('body').removeClass('waitingSwipe');
                learnedUI = true;
            }
            $('canvas[data-surface_element="' + $(this).data('surface_element') + '"]').each(function(){
                var currentCanvas = renderCanvases[$(this).data('element_index')];
                switch (swipeDirection)
                {
                case "left" :
                    if (currentCanvas.colorSpaceColumn != 0) {
                        currentCanvas.colorSpaceColumn--;
                    } else {
                        currentCanvas.colorSpaceColumn = 9;
                    }
                    break;
                case "right" :
                    if (currentCanvas.colorSpaceColumn != 9) {
                        currentCanvas.colorSpaceColumn++;
                    } else {
                        currentCanvas.colorSpaceColumn = 0;
                    }
                    break;
                case "up" :
                    if (currentCanvas.colorSpaceRow != 0) {
                        currentCanvas.colorSpaceRow--;
                    } else {
                        currentCanvas.colorSpaceRow = 7;
                    }
                    break;
                case "down" :
                    if (currentCanvas.colorSpaceRow != 7) {
                        currentCanvas.colorSpaceRow++;
                    } else {
                        currentCanvas.colorSpaceRow = 0;
                    }
                    break;
                }
                renderColor[0] = colorSpaces[currentCanvas.colorSpaceRow][currentCanvas.colorSpaceColumn].r;
                renderColor[1] = colorSpaces[currentCanvas.colorSpaceRow][currentCanvas.colorSpaceColumn].g;
                renderColor[2] = colorSpaces[currentCanvas.colorSpaceRow][currentCanvas.colorSpaceColumn].b;
                currentCanvas.tintSurface();
                event.gesture.preventDefault();
            });
        });
    } else {
        $('#swatches').on('dragstart', 'img', function(event) {
            currentColor = $(this).parent().css('backgroundColor');
            setRenderColor(currentColor);
            currentRow = $(this).parent().data(this.row_id);
            currentColumn = $(this).parent().data(this.column_id);
        });
        SVGpaths.on("dragleave", function(event) {
            $(this).stop().animate({opacity: 0},100);
            $(this).css('fill-opacity','0.4');

        });
        SVGpaths.on("dragover", function(event) {
            if (event.preventDefault) {
                event.preventDefault();
            }
            return false;
        });
        SVGpaths.on("dragenter", function(event) {
            $(this).css('fill',currentColor).stop().animate({opacity: 1},100);
            $(this).css('fill-opacity','1');
            return false;
        });
        SVGpaths.on("drop", function(event) {
            if (event.stopPropagation) {
                event.stopPropagation();
            }
            $(this).stop().animate({opacity: 0},100);
            $('canvas[data-surface_element="' + $(this).data('surface_element') + '"]').each(function(){
                renderCanvases[$(this).data('element_index')].tintSurface();
                renderCanvases[$(this).data('element_index')].colorSpaceRow = currentRow;
                renderCanvases[$(this).data('element_index')].colorSpaceColumn = currentColumn;
            });
            return false;
        });
    }

    if (displayLoading) {
        $('body').addClass('initComplete');
        $('body').removeClass('displayLoading');
        displayLoading = false;
    }
    if (loadingApp) {
        $('body').removeClass('loadingApp');
        loadingApp = false;
    }
}

$(document).ready(function() {
    if (Modernizr.touch){
        $('body').addClass('touchEnabled');
        deviceTouch = true;
    };
});

$(window).load(function() {
    //$('body').animate({opacity: 1},1000, function(){
    initApp();
    //});
});



/*

######## TO DO ########


var dataSrc32 = new Uint32Array(arrayBuffer);
for (var y = 0; y < bufferSize; ++y) {
  dataSrc32[y] = 0xFF7FFFFF;
}

var data = imageData.data;
var index = data.length - 1;
do {
  data[index] = dataSrc[index];
} while (index--);
ctx.putImageData(imageData, 0, 0);





var clampedArray = new Uint8ClampedArray(bufferSizeByte);
for (y = 0; y < bufferSizeByte; y+=4) {
  clampedArray[y] = 0xFF;
  clampedArray[y+1] = 0x7F;
  clampedArray[y+2] = 0xFF;
  clampedArray[y+3] = 0xFF;
}

var data = imageData.data;
if (data.set) {
  data.set(clampedArray);
} else {
  var index = data.length - 1;
  do {
    data[index] = clampedArray[index];
  } while (index--);
}
ctx.putImageData(imageData, 0, 0);










Concatenate my JS with modernizer and hammer scripts

*/