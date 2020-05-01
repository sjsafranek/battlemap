
// returns true if every pixel's uint32 representation is 0 (or "blank")
// https://stackoverflow.com/questions/17386707/how-to-check-if-a-canvas-is-blank
function isCanvasBlank(canvas) {
    const context = canvas.getContext('2d');

    const pixelBuffer = new Uint32Array(
        context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );

    return !pixelBuffer.some(color => color !== 0);
}




var App = function(mapId) {
    var self = this;

    // container for layers
    this.layers = {
        imageLayer: null,
        gridLayer: null
    };

    // initialize map
	this.map = L.map(mapId, {
		crs: L.CRS.Simple,
        minZoom: -5
	});

    //
    this.map.on('contextmenu', function(e) {
        self.addMarker(e);
    });

    // enableFileDrop(
    //     $(this.map._container),
    //     function(file) {
    //         self.onFileUpload(file);
    //     }
    // );

    this._addControls();
    this._addDrawing();

    // initialize grid
	this.map.fitBounds([[0, 0], [2000, 2000]]);
    this.drawGrid();
    this.map.setZoom(this.map.getZoom()+1)
}

App.prototype._addDrawing = function() {
    var self = this;

    this._drawing = false;
    this._mouseDown = false;

    this.drawLayer = L.canvasLayer()
        .delegate(this)     // -- if we do not inherit from L.CanvasLayer we can setup a delegate to receive events from L.CanvasLayer
        .addTo(this.map);

    this.drawFeatures = [
        {
            erase: this.elements.$eraseDrawingInput.is(':checked'),
            lineWidth: parseInt(this.elements.$lineWidthInput.val()),
            strokeStyle: this.elements.$strokeColorInput.val(),
            path: []
        }
    ];

    this.map.on('mousedown', function(e) {
        if (self._drawing) {
            self._mouseDown = true;
        }
    });

    this.map.on('mouseup', function(e) {
        if (self._drawing) {
            self._mouseDown = false;
            self.drawFeatures[self.drawFeatures.length-1].path.length &&
                self.drawFeatures.push({
                    erase: self.elements.$eraseDrawingInput.is(':checked'),
                    lineWidth: parseInt(self.elements.$lineWidthInput.val()),
                    strokeStyle: self.elements.$strokeColorInput.val(),
                    path: []
                });
        }
    });

    this.map.on('mousemove', function(e) {
        if (self._drawing && self._mouseDown) {
            self.drawFeatures[self.drawFeatures.length-1].path.push(e.latlng);
            self.drawLayer.drawLayer();
        }
    });
}

App.prototype.clearDrawing = function() {
    this.drawFeatures = [{
        erase: this.elements.$eraseDrawingInput.is(':checked'),
        lineWidth: parseInt(this.elements.$lineWidthInput.val()),
        strokeStyle: this.elements.$strokeColorInput.val(),
        path: []
    }];
    this.drawLayer.drawLayer();
}

App.prototype._addControls = function() {
    var self = this;

    // resources
    this.elements = {

        $cellSizeInput: $('<input>', {
                id: 'cellSize',
                type: 'number',
                min: 5,
                max: 1000,
                value: 100
            })
            .addClass('form-control form-control-sm')
            .on('change', function(e) {
                self.onCellSizeChange(e);
            }),

        $fileUploadInput: $('<input>', {
                id: 'fileUpload',
                type: 'file',
                accept: 'image/png, image/jpeg'
            })
            .addClass('form-control-file')
            .on('change', function(e) {
                self.onFileUpload(this.files[0]);
            }),

        $enableDrawModeInput: $('<input>', {
                id: 'enableDraw',
                type: 'checkbox'
            })
            .addClass('form-check-input')
            .on('change', function(e) {
                $(this).is(':checked') ?
                    self.enableDraw() : self.disableDraw();
            }),

        $lineWidthInput: $('<input>', {
                id: 'lineWidth',
                type: 'number',
                step: 2,
                min: 2,
                max: 64,
                value: 4
            })
            .addClass('form-control form-control-sm')
            .on('change', function(e) {
                self.onLineWidthChange(parseInt(this.value));
            }),

        $strokeColorInput: $('<input>', {
                id: 'strokeColor',
                type: 'color',
                value: '#000000'
            })
            .addClass('form-control form-control-sm')
            .on('change', function(e) {
                self.onStrokeColorChange(this.value);
            }),

        $eraseDrawingInput: $('<input>', {
                id: 'eraseDrawing',
                type: 'checkbox'
            })
            .addClass('form-check-input')
            .on('change', function(e) {
                $(this).is(':checked') ?
                    self.enableErase() : self.disableErase();
            }),

    };

    this.controls = L.control({position: 'topright'});
    this.controls.onAdd = function(map) {
        return $('<div>')
            .addClass('leaflet-control controls')
            .on('contextmenu', function(event) {
                event.stopPropagation();
            })
            .append(

                $('<div>')
                    .addClass('form-group mb-2')
                    .append(
                        $('<label>', {for: 'fileUpload'})
                            .addClass('form-check-label')
                            .append('Background Image'),
                        self.elements.$fileUploadInput
                    ),

                $('<div>')
                    .addClass('form-group row mb-2')
                    .append(
                        $('<label>', {for: 'cellSize'})
                            .addClass('col-sm-4 col-form-label')
                            .append('Grid Size'),
                        $('<div>')
                            .addClass('col-sm-8')
                            .append(
                                self.elements.$cellSizeInput
                            )
                    ),

                $('<div>')
                    .addClass('form-group mb-2 form-check form-check-inline')
                    .append(
                        self.elements.$enableDrawModeInput,
                        $('<label>', {for: 'enableDraw'})
                            .addClass('form-check-label')
                            .append('Draw mode')
                    ),

                $('<div>')
                    .addClass('draw-controls pl-4')
                    .append(
                        $('<div>')
                            .addClass('form-group row mb-2')
                            .append(
                                $('<label>', {for: 'lineWidth'})
                                    .addClass('col-sm-3 col-form-label')
                                    .append('Width'),
                                $('<div>')
                                    .addClass('col-sm-9')
                                    .append(
                                        self.elements.$lineWidthInput
                                    )
                            ),
                        $('<div>')
                            .addClass('form-group row mb-2')
                            .append(
                                $('<label>', {for: 'strokeColor'})
                                    .addClass('col-sm-3 col-form-label')
                                    .append('Color'),
                                $('<div>')
                                    .addClass('col-sm-9')
                                    .append(
                                        self.elements.$strokeColorInput
                                    )
                            ),
                        $('<div>')
                            .addClass('form-group mb-2 form-check form-check-inline')
                            .append(
                                self.elements.$eraseDrawingInput,
                                $('<label>', {for: 'eraseDrawing'})
                                    .addClass('form-check-label')
                                    .append('Erase')
                            )
                    )
                    .hide()

            )[0];
    };
    this.controls.addTo(this.map);
    L.preventPropogation(this.controls, this.map);
}

App.prototype.onLineWidthChange = function(lineWidth) {
    this.drawFeatures[this.drawFeatures.length-1].lineWidth = lineWidth;
}

App.prototype.onStrokeColorChange = function(strokeColor) {
    this.drawFeatures[this.drawFeatures.length-1].strokeStyle = strokeColor;
}

App.prototype.enableErase = function() {
    this.drawFeatures[this.drawFeatures.length-1].erase = true;
}

App.prototype.disableErase = function() {
    this.drawFeatures[this.drawFeatures.length-1].erase = false;
}

App.prototype.onDrawLayer = function(event) {
    var map = event.layer._map;
    var ctx = event.canvas.getContext('2d');
    ctx.clearRect(0, 0, event.canvas.width, event.canvas.height);

    for (var i = 0; i < this.drawFeatures.length; i++) {
        let feature = this.drawFeatures[i];
        let last = null;

        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
        ctx.globalCompositeOperation = (feature.erase ? 'destination-out' : 'source-over');

        ctx.beginPath();
        ctx.strokeStyle = feature.strokeStyle;
        ctx.lineWidth = feature.lineWidth;
        ctx.lineJoin = "round";

        for (var j=0; j<feature.path.length; j++) {
            var latlng = feature.path[j];
            // if (!event.bounds.contains(latlng)) {
            //     last = null;
            //     return;
            // }

            var dot = map.latLngToContainerPoint(latlng);
            if (last) {
                ctx.moveTo(last.x, last.y);
                ctx.lineTo(dot.x, dot.y);
            }
            last = dot;
        }

        // ctx.closePath();
        ctx.stroke();

        // TODO check if canvas is empty
        if (isCanvasBlank(event.canvas) && this.drawFeatures.length > 1) {
            console.log("isCanvasBlank before splice", this.drawFeatures.length);
            this.drawFeatures = [];
            this.drawFeatures.push({
                erase: this.elements.$eraseDrawingInput.is(':checked'),
                lineWidth: parseInt(this.elements.$lineWidthInput.val()),
                strokeStyle: this.elements.$strokeColorInput.val(),
                path: []
            });
            console.log("isCanvasBlank after splice", this.drawFeatures.length);
            this.onDrawLayer(event);
            return;
        }

    }
};

App.prototype.onFileUpload = function(file) {
    var self = this;

    // create file reader
    let reader = new FileReader();

    // parse file listener
    reader.onload = function(e) {
        // create image
        let img = new Image();
        img.src = e.target.result;

        // drawing of the test image - img1
        img.onload = function() {
            // load image onto map
            var bounds = [[0,0], [img.height, img.width]];
            var imageLayer = L.imageOverlay(e.target.result, bounds);
            imageLayer.addTo(self.map);

            // cleanup old layer
            self.imageLayer && self.imageLayer.remove();

            // add new layer
            self.imageLayer = imageLayer;

            self.map.fitBounds(bounds);

            // draw battle grid
            self.drawGrid(bounds);
        };
    }

    // read file
    reader.readAsDataURL(file);
}

App.prototype.onCellSizeChange = function(e) {
    if (!this.imageLayer) {
        this.drawGrid();
        return;
    }
    var bbox = this.imageLayer.getBounds();
    this.drawGrid([
        [bbox._southWest.lat, bbox._southWest.lng],
        [bbox._northEast.lat, bbox._northEast.lng]
    ]);
}

App.prototype.drawGrid = function(bounds) {
    let cellSize = parseInt(this.elements.$cellSizeInput.val());

    bounds = bounds || [[0,0],[cellSize*20, cellSize*20]];

    // cleanup old layer
    this.gridLayer && this.gridLayer.remove();

    let canvas = $('<canvas>')[0];
    let context = canvas.getContext('2d');
    canvas.height = bounds[1][0];
    canvas.width  = bounds[1][1];

    let nX = Math.floor(canvas.width / cellSize) - 2;
    let nY = Math.floor(canvas.height / cellSize) - 2;
    let pX = canvas.width - nX * cellSize;
    let pY = canvas.height - nY * cellSize;

    let pL = 0;
    let pT = 0;
    let pR = canvas.width - nX * cellSize - (pX);
    let pB = canvas.height - nY * cellSize - (pY);

    context.strokeStyle = 'black';
    context.lineWidth = 2;
    // context.setLineDash([5, 3])
    // context.setLineDash([10, 8])
    context.beginPath();
    for (var x = pL; x <= canvas.width - pR; x += cellSize) {
        context.moveTo(x, pT);
        context.lineTo(x, canvas.height - pB);
    }
    for (var y = pT; y <= canvas.height - pB; y += cellSize) {
        context.moveTo(pL, y);
        context.lineTo(canvas.width - pR, y);
    }
    context.stroke();

    // cleanup old layer
    this.gridLayer && this.gridLayer.remove();
    var gridLayer = L.imageOverlay(canvas.toDataURL(), bounds);
    gridLayer.addTo(this.map);
    this.gridLayer = gridLayer;
}

App.prototype.addMarker = function(e) {
    var self = this;
    this._count = this._count || 0;
    this._count++;

    var iconSettings = {
		mapIconUrl: `
            <svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 149 178"><path fill="{mapIconColor}" stroke="#FFF" stroke-width="6" stroke-miterlimit="10" d="M126 23l-6-6A69 69 0 0 0 74 1a69 69 0 0 0-51 22A70 70 0 0 0 1 74c0 21 7 38 22 52l43 47c6 6 11 6 16 0l48-51c12-13 18-29 18-48 0-20-8-37-22-51z"/>
                <circle fill="{mapIconColorInnerCircle}" cx="74" cy="75" r="61"/>
                <g>
                    <circle fill="#FFF" cx="74" cy="75" r="{pinInnerCircleRadius}"/>
                    <text x="50%" y="50%" text-anchor="middle" stroke="#51c5cf" stroke-width="2px" dx="-0.05em" dy="0.1em" font-size="65px">
                        ` + this._count + `
                    </text>
                </g>
            </svg>
        `,
		mapIconColor: randomColor(),
		mapIconColorInnerCircle: '#fff',
		pinInnerCircleRadius: 48
	};

    let cellSize = parseInt(this.elements.$cellSizeInput.val());
    let latlng = e.latlng;
    latlng.lat = latlng.lat - (latlng.lat % cellSize) + (cellSize/2);
    latlng.lng = latlng.lng - (latlng.lng % cellSize) + (cellSize/2);

    let marker = L.marker(
        latlng,
        {
            draggable: true,
            icon: L.divIcon({
                className: "leaflet-data-marker",
                iconAnchor  : [15, 30],
                iconSize    : [30, 30],
                popupAnchor : [0, -28],
                html: L.Util.template(iconSettings.mapIconUrl, iconSettings)
            })
        });

    marker
        .on('contextmenu', function(event) {
            event.originalEvent.stopPropagation();
            this.remove();
        })
        .on('dragend', function(event) {
            let cellSize = parseInt(self.elements.$cellSizeInput.val());
            let latlng = this.getLatLng();
            latlng.lat = latlng.lat - (latlng.lat % cellSize) + (cellSize/2);
            latlng.lng = latlng.lng - (latlng.lng % cellSize) + (cellSize/2);
            this.setLatLng(latlng);
        });

    marker.addTo(this.map);
}

App.prototype.enableDraw = function() {
    $('.draw-controls').show();
    this._drawing = true;
    this.map.touchZoom.disable();
    this.map.doubleClickZoom.disable();
    this.map.scrollWheelZoom.disable();
    this.map.dragging.disable();
}

App.prototype.disableDraw = function() {
    $('.draw-controls').hide();
    this._drawing = false;
    this.map.touchZoom.enable();
    this.map.doubleClickZoom.enable();
    this.map.scrollWheelZoom.enable();
    this.map.dragging.enable();
}
