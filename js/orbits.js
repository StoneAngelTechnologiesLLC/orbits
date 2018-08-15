
function distance(p1, p2) {
    let dx = p1.x - p2.x;
    let dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function angle(p1, p2) {
    let dx = p2.x - p1.x;
    let dy = -(p2.y - p1.y);
    let alpha = Math.atan2(dy, dx);
    if (alpha < 0) alpha = 2 * Math.PI + alpha;
    return alpha;
}

function Vector(p1, p2) {
    this.mag = distance(p1, p2);
    this.angle = angle(p1, p2);
    this.origin = {
        x: p1.x,
        y: p1.y
    },
    this.dest = {
        x: p2.x,
        y: p2.y
    }
}

class Slider {
    constructor (id, _settings) {
        let settings = _settings || {};
        this.min = settings.min || 0;
        this.max = settings.max || 100;
        this.value = settings.value || 0;
        this.className = settings.className || 'slider';
        this.handlers = {};
        this.container = $(`<div class = 'slider-container'>`);
        this.slider = $(`<input type = range min = "${this.min}" max = "${this.max}" value = "${this.value}" class = "${this.className}">`);
        this.sliderText = $(`<div class = "${this.className}-value">`);
        this.container.append(this.slider, this.sliderText);
        $(`#${id}`).append(this.container);
        this.slider.on('input', this.onInput.bind(this));
        this.setValue(this.value)
    }

    on (event, cb) {
        this.handlers[event] = cb;
    }

    off (event) {
        delete this.handlers[event];
    }

    setValue (v) {
        this.value = v;
        this.valuePercent = this.value/this.max;
    }

    get valueText() {
        return this.sliderText.text();
    }

    set valueText(value) {
        this.sliderText.text(value);
        let sliderPos = this.value / this.max;
        let pixelPosition = this.slider.width() * sliderPos;
        let pos = pixelPosition - (this.sliderText.width()/2);
        this.sliderText.css('left', pos)
    }

    onInput (ev) {
        this.setValue(ev.target.value);
        if (this.handlers['input']) this.handlers['input'](ev);
    }
}
class System {
    constructor(_opts) {
        let opts = _opts || {}
        this.planets = opts.planets || [];
        this.G = opts.G || .3
        this.swallows = [];
        this.frame = 0;
        this.collisions = 0;
        this.fastest = 0;
        this.farthest = 0;
        this.scale = opts.scale || 1;
        this.bounds = this.getBounds();
    }

    getBounds() {
        return {
            x: {
                min: 0,
                max: $('#content').width(),
                center: $('#content').width() / 2
            },
            y: {
                min: 0,
                max: $('#content').height(),
                center: $('#content').height() / 2
            }

        }
    }

    add(planet) {
        this.planets.push(planet);
    }

    fromScaled(point) {
        let x = point.x - this.bounds.x.center;
        let y = point.y - this.bounds.y.center;
        x = x / this.scale;
        y = y / this.scale;
        x += this.bounds.x.center;
        y += this.bounds.y.center;
        return {
            x: x,
            y: y
        }
    }
    toScaled(point) {
        let x = point.x - this.bounds.x.center;
        let y = point.y - this.bounds.y.center;
        x = x * this.scale;
        y = y * this.scale;
        x += this.bounds.x.center;
        y += this.bounds.y.center;
        return {
            x: x,
            y: y
        }
    }


    run() {
        this.startTime = Date.now();

        requestAnimationFrame(render.bind(this));

        function render(timestamp) {
            this.fastest = 0;
            this.farthest = {
                mag: 0
            };

            this.planets.forEach((subject, i) => {
                subject.force = { x: 0, y: 0 }
                this.addForces(subject, i, this.collide.bind(this));
            });

            this.planets.forEach(planet => {
                planet.move();
                if (planet.speed > this.fastest) this.fastest = planet.speed;
            });

            this.frame++
            this.data = {
                frames: this.frame,
                fps: (1 / (timestamp - this.lastTimestamp) * 1000).toFixed(0),
                planets: this.planets.length - 1,
                collisions: this.collisions,
                fastest: this.fastest.toFixed(3),
                farthest: this.farthest
            }
            $('#data').text(JSON.stringify(this.data, null, 2));
            this.lastTimestamp = timestamp;
            requestAnimationFrame(render.bind(this));
        }
    }

    addForces(subject, i, onCollision) {
        this.planets.forEach((object, j) => {
            if (subject != object) {
                let vector = new Vector(object, subject);
                if (vector.mag > this.farthest.mag) {
                    this.farthest = vector
                }
                let minDistance = (object.radius + subject.radius);
                if (vector.mag > minDistance) {
                    let fMag = this.G * (subject.mass * object.mass) / (vector.mag * vector.mag);
                    subject.force.x += -fMag * Math.cos(vector.angle);
                    subject.force.y += fMag * Math.sin(vector.angle);
                } else {
                    onCollision(i, j, vector);
                }
            }
        });
    }

    collide(i, j, vector) {
        this.collisions++;
        let subject = this.planets[i];
        let object = this.planets[j];
        if (subject.mass > object.mass) {
            subject.swallow(object);
            this.planets.splice(j, 1);
        } else {
            object.swallow(subject);
            this.planets.splice(i, 1);
        }
    }
}

class Planet {
    constructor(opts) {
        this.system = opts.system;
        this.name = opts.name | `p${this.system.planets.length}`,
        this.isMoveable = opts.isMoveable;
        this.mass = opts.mass;
        this.type = opts.type;
        this.v = opts.v;
        let center = this.system.fromScaled({
            x: opts.x,
            y: opts.y
        });
        this.x = center.x;
        this.y = center.y;
        this.force = {
            x: 0,
            y: 0
        }
        this.div = $(`<div class = "planet ${this.type ? this.type : ''}">`);
        $('#content').append(this.div);
        this.draw()

    }

    swallow(planet, vector) {
        let m = {
            x: (this.mass * this.v.x) + (planet.mass * planet.v.x),
            y: (this.mass * this.v.y) + (planet.mass * planet.v.y)
        }
        this.mass += planet.mass;

        let v = {
            x: m.x / this.mass,
            y: m.y / this.mass
        }
        this.v = v;
        this.draw();
        planet.remove();
    }

    remove() {
        this.div.css('display', 'none');
    }

    move() {
        if (this.isMoveable) {
            let a = {
                x: this.force.x / this.mass,
                y: this.force.y / this.mass
            }
            this.v = {
                x: this.v.x + a.x,
                y: this.v.y + a.y
            }
            this.speed = Math.sqrt(this.v.x * this.v.x + this.v.y * this.v.y);
            this.x = this.x + this.v.x;
            this.y = this.y + this.v.y;
        }
        this.draw();

    }

    draw() {
        this.radius = Math.pow(this.mass, 1 / 3);
        let scaledRadius = Math.max(.5, Math.round(this.radius * this.system.scale));
        let scaledDiameter = scaledRadius * 2;
        this.div.width(Math.round(scaledDiameter));
        this.div.height(Math.round(scaledDiameter));
        let center = this.system.toScaled({
            x: this.x,
            y: this.y
        })
        this.div.css('top', Math.round(center.y - scaledRadius));
        this.div.css('left', Math.round(center.x - scaledRadius));
    }
}

$(document).ready(function () {

    let maxG = 3;
    let MAX_SUN_SIZE = 100000;
    let system = new System({
        scale: 1,
        G: .3
    });

    let sun = new Planet({
        system: system,
        name: 'Sun',
        type: 'sun',
        isMoveable: false,
        mass: 20000,
        v: {
            x: 0,
            y: 0
        },
        x: $('#content').width() / 2,
        y: $('#content').height() / 2
    });

    system.add(sun);

    let autoScale = $("#auto-scale-btn");
    autoScale.on('click', () => {
        let width = Math.abs(system.data.farthest.origin.x - system.data.farthest.dest.x);
        let height = Math.abs(system.data.farthest.origin.y - system.data.farthest.dest.y);
        let xScale = system.bounds.x.max/width;
        let yScale = system.bounds.y.max/height;
        let scale = Math.min(xScale, yScale);
        system.scale = scale;
    })

    let randomBtn = $("#random-btn");
    let fixedSunInput = $("#fixed-sun-input");
    fixedSunInput.on('change', (ev) => {
        system.planets[0].isMoveable = !ev.target.checked;
    });

    let sunMassSlider = new Slider('sun-mass-slider', {
        min: 0,
        max: 1000,
        value: 1000 * sun.mass/MAX_SUN_SIZE
    });
    sunMassSlider.valueText = sun.mass;

    sunMassSlider.on('input', ev => {
        sun.mass = MAX_SUN_SIZE * (ev.target.value / 1000);
        sunMassSlider.valueText = Math.round(sun.mass);
        sun.draw();
    })

    let gSlider = new Slider('g-constant-input', {
        min: 0,
        max: 100,
        value: 100 * system.G/maxG
    });
    gSlider.valueText = system.G.toFixed(2);
    gSlider.on('input', ev => {
        system.G = maxG * (ev.target.value / 100);
        gSlider.valueText = system.G.toFixed(2);
        console.log("G = " + system.G)
    })

    let scaleSlider = new Slider('scale-input', {
        min: 1,
        max: 100,
        value: 1,
    });
    scaleSlider.valueText = 1;
    scaleSlider.on('input', ev => {
        let scale = Math.min(1, 5 / Math.pow(ev.target.value, 1.8));
        scaleSlider.valueText = scale.toFixed(2);
        system.scale = scale;
    });

    randomBtn.on('click', fillRandomPlanets)

    $('#content').on('mousedown', createPlanet);

    function createPlanet(ev) {
        $('#content').off('mousedown');

        let x = ev.clientX;
        let y = ev.clientY;
        let planet = new Planet({
            system: system,
            isMoveable: true,
            mass: 0,
            v: {
                x: 0,
                y: 0
            },
            x: x,
            y: y
        });

        $('#content').on('mousemove', sizePlanet);
        $('#content').on('mouseup', addPlanet);

        function sizePlanet(ev) {
            let vector = new Vector(system.fromScaled({ x: x, y: y }), system.fromScaled({ x: ev.clientX, y: ev.clientY }));
            planet.mass = Math.pow(vector.mag / 3, 3);
            planet.draw();
        }

        function addPlanet(ev) {
            if (!planet.mass) {
                planet.mass = 500;
                planet.draw();
            }
            $('#content').off('mouseup');
            $('#content').off('mousemove');
            $('#content').off('mousedown');
            $('#content').on('mousedown', startVelocity)

            function startVelocity(ev) {
                $('#content').off('mousedown');
                let line = $("<div class = 'rubber-band'>");
                let origin = system.toScaled({
                    x: planet.x,
                    y: planet.y
                })
                line.css('top', origin.y);
                line.css('left', origin.x + 1);
                line.height(0);
                line.width(0);
                $('#content').append(line);

                $('#content').on('mousemove', setVelocity);
                $('#content').on('mouseup', launchPlanet)

                function setVelocity(ev) {

                    let vector = new Vector(origin,
                        {
                            x: ev.clientX,
                            y: ev.clientY
                        });

                    let endPoint = system.fromScaled({
                        x: ev.clientX,
                        y: ev.clientY
                    })

                    let mag = {
                        x: planet.x - endPoint.x,
                        y: planet.y - endPoint.y
                    }

                    let v = {
                        x: Math.sign(mag.x) * Math.pow(Math.abs(mag.x), 1.1) / 75,
                        y: Math.sign(mag.y) * Math.pow(Math.abs(mag.y), 1.1) / 75
                    }

                    planet.v = v;
                    line.height(vector.mag);
                    line.css('transform', `rotate(${Math.PI / 2 - vector.angle}rad)`);
                }


                function launchPlanet(ev) {
                    $('#content').off('mouseup');
                    $('#content').off('mousemove');
                    $('#content').off('mousedown');
                    line.remove();
                    system.add(planet);
                    $('#content').on('mousedown', createPlanet);
                }
            }
        }
    }

    function fillRandomPlanets(ev) {
        ev.stopPropagation();
        let vMax = 10;
        for (let p = 1; p < 1000; p++) {
            system.add(new Planet({
                system: system,
                type: 'water',
                isMoveable: true,
                mass: Math.random() * 20+ 1,
                v: {
                    x: Math.random() * 2 * vMax - vMax,
                    y: Math.random() * 2 * vMax - vMax
                },
                x: Math.random() * $('#content').width(),
                y: Math.random() * $('#content').height()
            }));
        }
    }


    system.run();
})




