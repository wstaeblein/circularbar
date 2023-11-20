<script>
    import Circularbar from './circularbar.svelte';
	let value = 51.53;
	let value2 = 32;
	let value3 = 77;
    let v3Checked = false;
    let range = 400;

    function spin() {
        value = Math.floor(Math.random() * 100) + Math.random();
    }
</script>

<main>
	<h1>Circular Bar</h1>
	<p>A Svelte component that emulates a circular percent based progress bar</p>
    <br>

    <div>
        <div>
            <dfn>1</dfn>
            <Circularbar bind:value decimals={true} info="{'Click below\nfor value'}"></Circularbar>
            <div class="cmd">
                <button on:click={spin}>Generate</button>
            </div>            
        </div>
        <div>
            <dfn>2</dfn>
            <Circularbar bind:value={value2} info="Enter value below" color="#1cda81" thickness="10%"></Circularbar>
            <div class="cmd">
                <input type="number" bind:value={value2} />
            </div>
        </div>
        <div>
            <dfn>3</dfn>
            <Circularbar bind:value={value3} checkable="{true}" discRadius="{90}" bind:checked={v3Checked} color="dodgerblue" thickness="15%"></Circularbar>
            <div class="cmd">
                <input type="range" bind:value={value3} />
            </div>
        </div>
    </div>
    <aside>
        <br>
        <div style="justify-content: center; text-transform: uppercase"><b>Item 3 is{v3Checked ? '' : ' not'} checked</b></div>
        <p>Change the viewport size to see how the bars adapt</p>
    </aside>
    <br><br>
</main>

<style>
    input[type=number] {
        background: transparent; 
        max-width: 70px; 
        color: #eee;
        font-size: smaller;
    }

    input[type=range] {
        background: transparent; 
        max-width: 90%; 
        color: #eee;
    }

    dfn {
        font-size: 28px;
        font-style: normal;
    }
    
    div {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        margin: auto;
    }

    div > div {
        display: flex;
        flex-direction: column;
        width: 31%;
    }

	main {
		text-align: center;
		padding: 5px;
		max-width: 700px;
        width: 100%;
		margin: 0 auto;
        height: auto;
        box-sizing: border-box;
	}

	h1 {
		color: crimson;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
        margin: 0;
	}

    div.cmd {
        margin: 0;
        font-size: 20px;
        display: block;
        width: 100%;
    }
</style>