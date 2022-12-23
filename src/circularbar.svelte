<script>
    import { onMount } from 'svelte';
    export let value = 0;
    export let info = '';
    export let color;

    let newValue;                           // Value already validated
    let radius, side;
    let circle, hidCircle;                             // dd
    let rootEle, dot;                                // day_dot
    let rootWidth, rootHeight               
    let thickness = 8;                      // Thickness of stroke
    let textLarge, textSmall, percent;
    let max = 100;

    onMount(() => {
        calculate(value, rootWidth, rootHeight);
    });

    $: calculate(value, rootWidth, rootHeight);

    function calculate() { 
        
        newValue = value > max ? max : value < 0 ? 0 : value;

        if (circle) { 
            // Discount the stroke thickness on both sides
            side = Math.min(rootWidth, rootHeight);
            radius = (side - (thickness * 2)) / 2;

            if (color) { rootEle.style.setProperty('--def-circlebar-color', color); }

            let dashValue = Math.round(2 * Math.PI * radius);
            circle.style.strokeDashoffset = dashValue; 
            circle.style.strokeDasharray = dashValue; 

            circle.style.strokeWidth = thickness;
            circle.style.transform = `translate(${thickness}px, ${thickness}px)`;
            hidCircle.style.strokeWidth = thickness;
            hidCircle.style.transform = `translate(${thickness}px, ${thickness}px)`;

            // Value for dashoffset
            circle.style.strokeDashoffset = dashValue - (dashValue * newValue) / 100;

            // Font sizes
            textLarge.style.fontSize = Math.max((radius / 2), 18) + 'px';
            textSmall.style.fontSize = Math.max((radius / 6), 10) + 'px';
            textSmall.style.width = (side * 0.7) + 'px';
            percent.style.fontSize = Math.max((radius / 6), 10) + 'px';
        }
    }
</script>

<section bind:clientWidth={rootWidth}  bind:clientHeight={rootHeight} bind:this={rootEle} class="circle">
    <svg style="width: {side}px; height: {side}px">
        <circle cx="{radius}" cy="{radius}" r="{radius}" bind:this={hidCircle}></circle>
        <circle cx="{radius}" cy="{radius}" r="{radius}" color="{color}" bind:this={circle}></circle>
    </svg>
    <div class="info">
        <b bind:this={textLarge}>{newValue}</b><b bind:this={percent}>%</b>
        {#if info}
            <br>
            <div bind:this={textSmall}>{info}</div>
        {/if}
    </div>
</section>

<style>
    section {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        --def-circlebar-color: #f00;
        --def-circlebar-track: #eee;
        --def-circlebar-text: #444;
        --def-thickness: 8;
    }

    svg {
        position: relative;
        box-sizing: border-box;
        transform: rotate(270deg); 
    }

    svg > circle {
        width: 100%;
        height: 100%;  
        fill: transparent;
        stroke: var(--circlebar-track, var(--def-circlebar-track));
        transform: translate(5px, 5px);
        transition: all 0.2s ease;
    }

    svg > circle:last-child {
        stroke: var(--circlebar-color, var(--def-circlebar-color));
    }

    .info {
        position: absolute;
        text-align: center;
        font-weight: bold;
        color: var(--circlebar-text, var(--def-circlebar-text));
        text-transform: uppercase;
    }

    .info > div {
        font-weight: normal;
        width: 90%;
        margin: auto;
    }
</style>