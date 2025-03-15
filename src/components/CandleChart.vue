<template>
    <div ref="chartContainer" class="w-[800px] h-[500px]"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';

const props = defineProps({
    candles: {
        type: Array,
        required: true,
    },
});

const chartContainer = ref(null);
let chart;
let candlestickSeries;
let existingMarkers = [];
let markedTimes = new Set();
let lastPercentageChange = null; // Almacenar el último porcentaje de cambio
let initialLoad = true;

onMounted(() => {
    initializeChart();
    window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    if (chart) chart.remove();
    window.removeEventListener('resize', handleResize);
});

const initializeChart = () => {
    if (chart) {
        chart.remove();
        chart = null;
        candlestickSeries = null;
        existingMarkers = [];
        markedTimes.clear();
        lastPercentageChange = null;
        initialLoad = true;
    }

    chart = createChart(chartContainer.value, {
        width: chartContainer.value.clientWidth,
        height: chartContainer.value.clientHeight,
        layout: { backgroundColor: '#ffffff', textColor: '#333' },
        grid: { vertLines: { color: '#eee' }, horzLines: { color: '#eee' } },
        timeScale: { timeVisible: true },
    });

    candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });

    updateChartData();
};

const formatCandle = (candle) => {
    const timestamp = new Date(candle.time * 1000);
    if (isNaN(timestamp)) {
        console.error('Fecha inválida:', candle.time);
        return null;
    }
    return {
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
    };
};

const updateChartData = () => {
    if (!chart || !candlestickSeries) return;

    const formattedCandles = props.candles
        .map(candle => formatCandle(candle))
        .filter(c => c !== null);

    const uniqueCandles = formattedCandles.reduce((acc, curr) => {
        if (!acc.some(c => c.time === curr.time)) acc.push(curr);
        return acc;
    }, []);

    candlestickSeries.setData(uniqueCandles);

    if (uniqueCandles.length > 1) {
        const lastCandle = uniqueCandles[uniqueCandles.length - 1];
        const previousClose = uniqueCandles[uniqueCandles.length - 2].close;
        const currentClose = lastCandle.close;
        const percentageChange = ((currentClose - previousClose) / previousClose) * 100;

        const newMarker = {
            time: lastCandle.time,
            position: 'aboveBar',
            color: percentageChange >= 0 ? '#26a69a' : '#ef5350',
            shape: percentageChange >= 0 ? 'arrowUp' : 'arrowDown',
            text: `${percentageChange.toFixed(2)}%`,
            size: 1.5,
            yOffset: -10,
        };

        if (!markedTimes.has(lastCandle.time)) {
            markedTimes.add(lastCandle.time);
            existingMarkers.push(newMarker);
            lastPercentageChange = percentageChange; // Guardar el porcentaje de cambio
        } else {
            if (lastPercentageChange !== percentageChange) {
                if (existingMarkers.length > 0 && existingMarkers[existingMarkers.length - 1].time === newMarker.time) {
                    existingMarkers[existingMarkers.length - 1] = newMarker;
                    lastPercentageChange = percentageChange; // Actualizar el porcentaje de cambio
                }
            }
        }
    }

    createSeriesMarkers(candlestickSeries, existingMarkers);

    if (initialLoad) {
        chart.timeScale().fitContent();
        initialLoad = false;
    }
};

const handleResize = () => {
    if (chart) {
        chart.applyOptions({
            width: chartContainer.value.clientWidth,
            height: chartContainer.value.clientHeight,
        });
    }
};

watch(
    () => props.candles,
    () => updateChartData(),
    { deep: true }
);
</script>