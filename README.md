# Circular Bar

### A Svelte component that emulates a circular percent based progress bar

This component uses SVG to generate an animated circle progress bar showing a percentage or a button. It will show the percentage digits in the center of the circle together with an optional very short description or, if in checkable mode, a clickable disc. It will adapt to it's parent container and generate its box based on its parent smaller side. You can pick the colors, the short text description and, of course the value between 0 - 100.

Values above 100 will render as 100 and below 0 will render as 0.



![Example](public/sample.png)


[CHECK OUT THE ONLINE DEMO](https://wstaeblein.github.io/circularbar/)

## Usage

```html
<script>
    import Circularbar from './circularbar.svelte';
    let value = 0;
    let info = 'Description Here';
</script>

<main>
    <div>
        <Circularbar bind:value bind:info color="#1cda81"></Circularbar>             
    </div>
</main>

<style>
    div {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 150px;
        height: 150px;
    }
    main {
        text-align: center;
        padding: 1em;
        max-width: 240px;
        margin: 0 auto;
    }
</style>

```
There are a few props you can pass to this component:

| Name | Description | Type | Default | Required | Comments |
|---|---|---|:---:|:---:|---|
| color | Defines the progress color | HTML Color | EMPTY | No | Reverts to the CSS variable --def-circlebar-color |
| trackColor | Defines the progress' track color | HTML Color | EMPTY | No | Reverts to the CSS variable --def-circlebar-track |
| textColor | Defines the progress' text color | HTML Color | EMPTY | No | Reverts to the CSS variable --def-circlebar-text |
| info | Provides the text to be shown below the percentage | String | EMPTY | No | Use \n to break line |
| thickness | Sets the thickness of the bar in pixels or percentage | String | 5% | No | When using percentage, it is relative to the diameter of the circle |
| value | A value between 0 and 100 that sets the bar | Float | 0 | Yes | If the number provided < 0, it will be 0. If it is over 100, it stays at 100 |
| checkable | If true a clickable disc will be shown inside the graph and clicking it will toggle state | Boolean | false | No | Info won't be shown and value will account only for drawing of the graph. |
| checked | When in checkable mode holds the state of the component | Boolean | false | No | |
| decimals | When true the value is rounded to no more than 2 decimals | Boolean | false | No | Only when required |



There are a few supported CSS variables that can be used from your code to change the bar's colors. They are:

```css
--def-circlebar-color --> The progress color
--def-circlebar-track --> The track color
--def-circlebar-text  --> The text color
```
If you set them somewhere above this component's code (:root for instance), it should pick your colors and apply them.

## Instalation

**Only tested on Svelte 3**

This is so simple and has no dependencies that it doesn't need a NPM package. Just copy the file ``/src/circularbar.svelte`` to your project's appropriate folder and import it where needed as you would with any .svelte file. All other files are just here for the sake of the example.


## Example

Download this code, extract it and run:

```
npm i
npm run dev
```