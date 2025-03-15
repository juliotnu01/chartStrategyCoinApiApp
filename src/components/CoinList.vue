<template>
    <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-4">Monedas Binance Futures Perpetual</h1>
        <div v-if="coins.length === 0" class="text-center">Cargando...</div>
        <table v-else class="table-auto w-full">
            <thead>
                <tr>
                    <th class="border px-4 py-2">Símbolo</th>
                    <th class="border px-4 py-2">Precio</th>
                    <th class="border px-4 py-2">Gráfico</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(coin, c) in coins" :key="c">
                    <td class="border px-4 py-2">{{ c }}</td>
                    <td class="border px-4 py-2">{{ coin.price }}</td>
                    <td class="border px-4 py-2">
                        <button @click="openModal(coin, c)" :disabled="!coin.candles || coin.candles.length <= 0"
                            :class="{ 'bg-blue-500 hover:bg-blue-700': coin.candles && coin.candles.length > 0, 'bg-gray-500 cursor-not-allowed': !coin.candles || coin.candles.length <= 0 }"
                            class="text-white font-bold py-2 px-4 rounded">
                            Ver Gráfico
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>

        <div v-if="selectedCoin"
            class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
            <div class="relative p-5 bg-white rounded-lg max-w-4xl w-fit">
                <button @click="closeModal" class="absolute top-2 right-2 text-gray-500 hover:text-gray-800">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 class="text-xl font-bold mb-4">{{ selectedCoin.symbol_id }}</h2>
                <ChartComponent :candles="selectedCoin?.candles || []" :symbol-id="selectedCoin?.symbol_id" />
            </div>
        </div>
    </div>
</template>
<script setup>

import { storeToRefs } from 'pinia';
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useCoinApiStore } from '../stores/coinapi';
import ChartComponent from './CandleChart.vue';

const coinApiStore = useCoinApiStore();
const { coins } = storeToRefs(coinApiStore);
const { connectWebSocket, disconnectWebSocket } = coinApiStore;

const selectedCoinId = ref(null); // Guarda solo el ID de la moneda seleccionada
const selectedCoin = computed(() => {
    if (!selectedCoinId.value) return null;
    return coins.value[selectedCoinId.value]; // Obtiene la moneda seleccionada del store
});

onMounted(() => {
    connectWebSocket();
});

onUnmounted(() => {
    disconnectWebSocket();
});

const openModal = (coin, c) => {
    selectedCoinId.value = c; // Almacena solo el ID de la moneda seleccionada
};

const closeModal = () => {
    selectedCoinId.value = null; // Limpia la selección
};
</script>