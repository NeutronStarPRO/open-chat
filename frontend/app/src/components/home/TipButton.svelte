<script lang="ts">
    import { spring } from "svelte/motion";

    export let disabled = false;
    export let label: string;

    let buttonScale = spring(1);

    function mouseDown() {
        buttonScale.set(1.1);
        window.setTimeout(() => buttonScale.set(1), 200);
    }
</script>

<button
    style={`transform: scale(${$buttonScale})`}
    on:mousedown={mouseDown}
    {disabled}
    on:click|preventDefault
    class="amount">
    {label}
</button>

<style lang="scss">
    .amount {
        $size: 100px;
        border-radius: $sp3;
        padding: $sp4;
        border: 1px solid var(--bd);
        transition: background 250ms ease-in-out, color 250ms ease-in-out;
        text-align: center;
        cursor: pointer;
        height: $size;
        width: $size;
        border-radius: 50%;
        display: grid;
        align-content: center;
        background: transparent;
        color: var(--button-txt);
        background: var(--button-bg);
        position: relative;
        &:hover {
            background: var(--button-hv);
        }

        @include font(book, normal, fs-120);

        @include mobile() {
            $size: 100px;
            height: $size;
            width: $size;
        }

        &:disabled {
            background: transparent;
            color: var(--txt-light);
            cursor: not-allowed;
        }
    }
</style>
