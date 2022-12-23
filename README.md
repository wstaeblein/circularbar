# Circle Bar

### A Svelte component that emulates a circular percent based progress bar

This component uses SVG to generate an animated circle progress bar showing a percentage. It will show the percentage digits in the center of the circle together with an optional very short description. It will adapt to it's parent container and generate its box based on its parent smaller side. You can pick the colors, the short text description and, of course the value between 0 - 100.

Values above 100 will render as 100 and below 0 will render as 0.



![Example](public/sample.png)

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

There are a few supported CSS variables that can be used from your code to change the bar's colors. They are:

```
--def-circlebar-color --> The progress color
--def-circlebar-track --> The track color
--def-circlebar-text  --> The text color
```
If you set them somewhere above this component's code (:root for instance), it should pick your colors and apply them.

## Instalation

**Only tested on Svelte 3**

This is so simple and has no dependencies that it doesn't need a NPM package. Just copy the file ``/src/circularbar.svelte`` to your project's appropriate folder and import it where needed. All other files are just here for the sake of the example.


## Example

Download this code, extract it and run:

```
npm i
npm run dev
```