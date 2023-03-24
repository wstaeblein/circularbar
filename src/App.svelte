<script>
    import Circularbar from './circularbar.svelte';
	let value = 51;
	let value2 = 13;
    let range = 400;

    function spin() {
        value = Math.floor(Math.random() * 100) + 1;
        //value2 = Math.floor(Math.random() * 100) + 1;
    }
</script>

<main>
	<h1>Circle Bar</h1>
	<p>A Svelte component that emulates a circular percent based progress bar</p>
    <br><br><br>

    <div>
        <div>
            <Circularbar bind:value info="{'Click below\nfor value'}"></Circularbar>
            <p>
                <button on:click={spin}>Generate</button>
            </p>            
        </div>
        <div>
            <Circularbar bind:value={value2} info="Enter value below" color="#1cda81"></Circularbar>
            <p>
                <input type="number" bind:value={value2} style="background: transparent; width: 80px; color: #eee" />
            </p>
        </div>
    </div>
    <aside>
        <br>
        <p>Change the viewport size to see how the bars adapt</p>
    </aside>
    <br><br>
</main>

<style>
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
        gap: 20px;
        width: 50%;
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
        height: 170px;
	}

    p {
        margin: 0;
        font-size: 20px;
    }
</style>