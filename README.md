# MarlinScope

Microscopy dates to (at least) [the 16th century](https://www.sciencemuseum.org.uk/objects-and-stories/medicine/microscope), while 3D printing is firmly a 20th century invention. Yet, in 2023, it's far cheaper, and easier, to 3D print than to do any serious automated microscopy. These are just facts. 

Why is a weird combination of market power, market pull, and microscopy not being able to make pegboard hooks for my Ikea Skaadis, but we're not here for the why, we're here to use this weird imblance to make automated scanning microscopy a little bit easier by applying a core enabler of 3D printing to low cost microscopy: [Marlin](https://marlinfw.org/).

Marlin is the [gcode firmware engine](https://marlinfw.org/meta/gcode/) that runs on almost all cheap 3D printers in 2023. This means that 3D printer can be controlled at a lowish level by just throwing some serial strings at it. We exploit that here by taking these printers, again, they're cheap, like ~$300 or less for ~20µm step control, ripping off the hot end, and bolting some sort of microscope where the hotend was. If we're smart we'll use the hotend before we removed it to print out some parts to hold the scope in place.

This sounds janky, but the results are pretty fantastic. Large area HDR microscopy used to be very expensive with long lead times. Now it's available for a total BOM of under $500 and you can get it in a single amazon order.

## Guts

Marlinscope is node driven web app built on the bones of [nodeforwarder](https://github.com/dansteingart/nodeforwarder). It provides three web interfaces

- Camera and stage control (`/`)
- Serial port spy for gcode putzing (`/serial`)
- A simple gallery for viewinng images you've snapped ('/projects').

Like all my webtype code, it has a barebones low friction interface with a ton of poorly documented features and easter eggs that I code in at whim. 

Because this is just a node app, it is _very easy_ to script against this using python. This is _very, very_ useful for [EDOF imaging](https://mahotas.readthedocs.io/en/latest/edf.html).

## Prereqs
- This demands linux. A raspberry pi is perfect. We need [v4l2](https://en.wikipedia.org/wiki/Video4Linux) to make of lot of this easy.
- We need some port of zoomy camera mounted to the 3D printed stages. I like [this one](https://www.amazon.com/Microscope-Polarizer-Soldering-Jewelers-Collection/dp/B089H1NTL4/ref=sr_1_3?keywords=usb+digital+microscope+with+polarizer&qid=1678332376&sprefix=usb+microscope+polari%2Caps%2C77&sr=8-3&ufe=app_do%3Aamzn1.fos.18ed3cb5-28d5-4975-8bc7-93deae8f9840) because it has a polarizer and a light source.
- The imager flow expects a ustreamer instance to be running locally at port `8181`. ustreamer works really well with the aforementioned camera. ustreamer is just great, really.
- node 18.5
- If you want to do EDOF, you need python. Currently it's hacked in and expects some code to be sitting in [pithy](https://github.com/dansteingart/pithy)

## Install

```
git clone https://github.com/dansteingart/marlinscope
cd marlinescope
npm i
```

## Start
```
node server [HTTP_PORT] [SERIAL_PORT] [BAUD_RATE] 10000
```
For enderX units, a baud rate of `115200` generally works

If you're using the [monoprice MP Cadet or clones](https://www.amazon.com/s?k=mp+cadet) the baud rate should be `1000000` and you need to put a env flag before node to set  

```
CADET=true node server [HTTP_PORT] [SERIAL_PORT] 1000000 10000
```

## Use

Go to `http://DEVICE_IP:HTTP_PORT/`, if everything working you should see something that looks like this

![image](https://user-images.githubusercontent.com/152047/223910094-8ab618a9-c23b-4120-a7e2-33d911fab154.png)

You can push the little buttons to change all the things, but the cool kids use keyboard shortcuts wherever relevant

| Function | Key | Notes |
|----------|-----|-------|
| x + | `←` | Moves `move x/y` mm; if holding `Shift` moves `10 * move x/y` mm|
| x - | `→` | Moves `move x/y` mm; if holding `Shift` moves `10 * move x/y` mm|
| y + | `↑` | Moves `move x/y` mm; if holding `Shift` moves `10 * move x/y` mm|
| y - | `↓` | Moves `move x/y` mm; if holding `Shift` moves `10 * move x/y` mm|
| z + | `w` | Moves `move z` mm; if holding `Shift` moves `10 * move z` mm|
| z - | `s` | Moves `move z` mm; if holding `Shift` moves `10 * move z` mm|
| snap picture | `c` | snaps a picture and saves to `/projects`|

Filling out the meta section is being kind to your future self and other people in general. It just takes a second. Come on. Do it.

Z Scan takes a z stack of images, requires `/pithy/code/enderscope_z_scan.py` 

Camera controls modifies the current `v4l2` imager settings. I strongly recommend setting `x_auto` to `0`


