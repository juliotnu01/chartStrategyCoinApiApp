import { defineStore } from "pinia";

export const useCoinApiStore = defineStore("coinapi", {
    state: () => ({
        coins: {}, // Almacena los datos de las cotizaciones
        socket: null, // Referencia al WebSocket
        // apiKey: "bfd1013d-81ea-47a6-a661-dde1271169da", // Reemplaza con tu API key de CoinAPI
        apiKey: "322cd9b3-d2ca-4282-b343-ec2255b9eabd", // Reemplaza con tu API key de CoinAPI
        timeframes: { '1m': 60 }, // Configuración de timeframe
    }),
    actions: {
        connectWebSocket() {
            if (this.socket) {
                console.warn("Ya existe una conexión WebSocket activa.");
                return;
            }

            this.socket = new WebSocket("wss://ws.coinapi.io/v1");

            this.socket.onopen = () => {
                console.log("WebSocket conectado");
                this.subscribeToBinancePerpetual();
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.updateCoin(data);
            };

            this.socket.onclose = () => {
                console.log("WebSocket cerrado");
                this.socket = null; // Limpiar la referencia al socket
            };

            this.socket.onerror = (error) => {
                console.error("Error en WebSocket:", error);
                if (this.socket) {
                    this.socket.close(); // Cerrar la conexión en caso de error
                    this.socket = null;
                }
            };
        },
        disconnectWebSocket() {
            if (this.socket) {
                this.socket.close();
                this.socket = null;
                console.log("WebSocket desconectado");
            } else {
                console.warn("No hay una conexión WebSocket activa para cerrar.");
            }
        },
        async subscribeToBinancePerpetual() {
            if (!this.socket) return;

            try {


                const response = await fetch("https://rest.coinapi.io/v1/symbols?filter_exchange_id=BINANCEFTS", {
                    headers: { "X-CoinAPI-Key": this.apiKey },
                });

                const symbols = await response.json();
                const perpetualSymbols = symbols
                    .filter(s => s.symbol_id.includes("BINANCEFTS_PERP_BTC_USDT") && s.symbol_id.includes("BINANCEFTS_PERP_BTC_USDT"))
                    .map(s => s.symbol_id);

                // Inicializar estructura de datos
                perpetualSymbols.forEach(symbolId => {
                    this.coins[symbolId] = {
                        price: 0,
                        candles: [],
                        lastCandle: null
                    };
                });

                this.socket.send(JSON.stringify({
                    type: "hello",
                    apikey: this.apiKey,
                    heartbeat: true,
                    subscribe_data_type: ["trade","ohlcv"],
                    subscribe_filter_symbol_id: perpetualSymbols,
                }));

                // Cargar histórico en paralelo
                await Promise.all(perpetualSymbols.map(async symbolId => {
                    const candles = await this.fetchCandles(symbolId);
                    this.coins[symbolId].candles = candles
                        .sort((a, b) => new Date(a.time_period_start) - new Date(b.time_period_start));
                }));
            } catch (error) {
                console.error("Error:", error);
            }
        },
        processOHLCV(data) {
            const symbolId = data.symbol_id;
            if (!this.coins[symbolId]) return;
        
            // Crear timestamp redondeado al inicio del minuto
            const timestamp = new Date(data.time_period_start);
            timestamp.setSeconds(0, 0); // Eliminar segundos y milisegundos
            const time = Math.floor(timestamp.getTime() / 1000); // Unix en segundos
        
            const coin = this.coins[symbolId];
            let currentCandle = coin.candles.find(c => c.time === time);
        
            if (!currentCandle) {
                // Crear nueva vela si no existe para este minuto
                currentCandle = {
                    time: time,
                    open: data.price_open,
                    high: data.price_high,
                    low: data.price_low,
                    close: data.price_close
                };
                coin.candles.push(currentCandle);
            } else {
                // Actualizar valores OHLC existentes
                currentCandle.high = Math.max(currentCandle.high, data.price_high);
                currentCandle.low = Math.min(currentCandle.low, data.price_low);
                currentCandle.close = data.price_close;
            }
        
            // Ordenar y limitar a 50 velas
            coin.candles.sort((a, b) => a.time - b.time);
            if (coin.candles.length > 50) coin.candles.shift();
        },
        updateCoin(data) {
            if (data.type === "trade") {
                const symbolId = data.symbol_id;
                if (this.coins[symbolId]) {
                    this.coins[symbolId].price = data.price;

                    // // Actualizar última vela en tiempo real
                    // if (this.coins[symbolId].lastCandle) {
                    //     const currentCandle = this.coins[symbolId].lastCandle;
                    //     currentCandle.high = Math.max(currentCandle.high, data.price);
                    //     currentCandle.low = Math.min(currentCandle.low, data.price);
                    //     currentCandle.close = data.price;
                    // }
                }
            } else if (data.type === "ohlcv") {
                this.processOHLCV(data);
            }
        },
        async fetchCandles(symbolId) {
            try {
                const timeEnd = new Date().toISOString(); // Hora actual
                const timeStart = new Date(Date.now() - 50 * 60 * 1000).toISOString(); // 50 minutos atrás

                const response = await fetch(
                    `https://rest.coinapi.io/v1/ohlcv/${symbolId}/history?period_id=1MIN&time_start=${timeStart}&time_end=${timeEnd}&limit=50`,
                    {
                        headers: { "X-CoinAPI-Key": this.apiKey },
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const candles = await response.json();

                return candles.map(c => {
                    if (!c.time_period_start) {
                        console.error('Vela sin tiempo:', c);
                        return null;
                    }

                    const timestamp = new Date(c.time_period_start);
                    return {
                        time: Math.floor(new Date(c.time_period_start).getTime() / 1000),
                        open: c.price_open,
                        high: c.price_high,
                        low: c.price_low,
                        close: c.price_close,
                        symbol_id: symbolId
                    };
                })
                    .filter(c => c !== null)
                    .sort((a, b) => a.time - b.time);
                ;
            } catch (error) {
                console.error("Error al obtener velas:", error);
                return []; // Retorna un array vacío en caso de error
            }
        }
    },
});