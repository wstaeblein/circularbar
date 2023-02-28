<script>
    import Circularbar from './circularbar.svelte';
	let value = 51;
	let value2 = 13;

    function spin() {
        value = Math.floor(Math.random() * 100) + 1;
        //value2 = Math.floor(Math.random() * 100) + 1;
    }
</script>

<main>
	<h1>Circle Bar</h1>
	<p>A Svelte component that emulates a circular percent based progress bar</p>
    <br><br><br><br>

    <div>
        <div>
            <Circularbar bind:value info="Click for Value"></Circularbar>
            <p>
                <button on:click={spin}>Generate</button>
            </p>            
        </div>
        <div>
            <Circularbar bind:value={value2} info="Enter Value" color="#1cda81"></Circularbar>
            <p>
                <input type="number" bind:value={value2} style="background: transparent; width: 80px; color: #eee" />
            </p>
        </div>
    </div>
</main>

<style>

    div {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 50px;
        width: 150px;

        margin: auto;
    }

    div > div {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }


	main {
		text-align: center;
		padding: 1em;
		max-width: 400px;
		margin: 0 auto;
        height: auto;
	}

	h1 {
		color: crimson;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

</style>