<script>
    import { onMount } from 'svelte';
    export let value = 0;
    export let info = '';
    export let color;
    export let thickness = 0;               // Thickness of stroke

    let newValue;                           // Value already validated
    let radius, side;
    let circle, hidCircle;
    let rootEle;                                
    let rootWidth, rootHeight;             
    let textLarge, textSmall, percent;
    let max = 100;

    onMount(() => {
        calculate(value, rootWidth, rootHeight);
    });

    $: calculate(value, rootWidth, rootHeight);

    function calculate() { 
        newValue = (value > max ? max : value < 0 ? 0 : value) || 0;

        if (circle) { 
            let border = !thickness ? rootWidth / 20 : +thickness;
            
            // Discount the stroke thickness on both sides
            side = rootWidth;
            radius = (side - (border * 2)) / 2;

            if (color) { rootEle.style.setProperty('--def-circlebar-color', color); }

            let dashValue = Math.round(2 * Math.PI * radius);
            circle.style.strokeDashoffset = dashValue; 
            circle.style.strokeDasharray = dashValue; 

            circle.style.strokeWidth = border;
            circle.style.transform = `translate(${border}px, ${border}px)`;
            hidCircle.style.strokeWidth = border;
            hidCircle.style.transform = `translate(${border}px, ${border}px)`;

            // Value for dashoffset
            circle.style.strokeDashoffset = dashValue - (dashValue * newValue) / 100;

            // Font sizes
            textLarge.style.fontSize = Math.max((radius / 2), 12) + 'px';
            textSmall.style.fontSize = Math.max((radius / 6), 6) + 'px';
            textSmall.style.width = (side * 0.7) + 'px';
            percent.style.fontSize = Math.max((radius / 6), 10) + 'px';
        }
    }
</script>

<section bind:clientWidth={rootWidth} bind:this={rootEle} class="circle">
    <div class="container">
        <svg>
            <circle cx="{radius}" cy="{radius}" r="{radius}" bind:this={hidCircle}></circle>
            <circle cx="{radius}" cy="{radius}" r="{radius}" color="{color}" bind:this={circle}></circle>
        </svg>     
        <div class="info">
            <b bind:this={textLarge}>{newValue}</b><b bind:this={percent}>%</b>
            {#if info}
                <br>
                <div bind:this={textSmall}>{@html info}</div>
            {/if}
        </div>           
    </div>
</section>

<style>
    div.container {
        width: 100%;
        height: 0;
        padding-bottom: 100%;
    }
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
    }

    svg {
        box-sizing: border-box;
        transform: rotate(270deg); 
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
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
        font-weight: bold;
        color: var(--circlebar-text, var(--def-circlebar-text));
        text-transform: uppercase;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        white-space: pre-line;
    }

    .info > div {
        font-weight: normal;
        width: 90%;
        margin: auto;
    }
</style>