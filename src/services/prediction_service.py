"""Predictive analytics service for network metrics forecasting.

Uses simple linear regression for bandwidth prediction.
Can be upgraded to Prophet or ARIMA for more sophisticated forecasting.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import statistics

logger = logging.getLogger(__name__)


class PredictionService:
    """Service for predicting network metrics using statistical models."""

    def __init__(self):
        """Initialize prediction service."""
        pass

    def predict_bandwidth(
        self,
        history: List[Dict[str, Any]],
        forecast_hours: int = 4,
        resolution_minutes: int = 15,
    ) -> Dict[str, Any]:
        """Predict future bandwidth based on historical data.

        Uses linear regression on recent data to forecast future values.

        Args:
            history: List of historical data points with 'timestamp', 'sent', 'recv'
            forecast_hours: Hours to forecast into the future
            resolution_minutes: Resolution of forecast points in minutes

        Returns:
            Dict with forecast data and metadata
        """
        if not history or len(history) < 2:
            return {
                "success": False,
                "error": "Insufficient historical data for prediction",
                "forecast": [],
            }

        try:
            # Parse timestamps and extract values
            parsed_data = self._parse_history(history)
            if len(parsed_data) < 2:
                return {
                    "success": False,
                    "error": "Could not parse sufficient data points",
                    "forecast": [],
                }

            # Calculate trends for sent and received
            sent_forecast = self._linear_forecast(
                [p["timestamp"] for p in parsed_data],
                [p["sent"] for p in parsed_data],
                forecast_hours,
                resolution_minutes,
            )

            recv_forecast = self._linear_forecast(
                [p["timestamp"] for p in parsed_data],
                [p["recv"] for p in parsed_data],
                forecast_hours,
                resolution_minutes,
            )

            # Combine forecasts
            forecast_points = []
            now = datetime.utcnow()

            for i, (sent, recv) in enumerate(zip(sent_forecast["values"], recv_forecast["values"])):
                point_time = now + timedelta(minutes=i * resolution_minutes)
                forecast_points.append({
                    "timestamp": point_time.isoformat() + "Z",
                    "sent": max(0, sent),  # Ensure non-negative
                    "recv": max(0, recv),
                    "is_forecast": True,
                })

            # Calculate confidence based on R-squared
            avg_confidence = (sent_forecast["r_squared"] + recv_forecast["r_squared"]) / 2

            return {
                "success": True,
                "forecast": forecast_points,
                "metadata": {
                    "forecast_hours": forecast_hours,
                    "resolution_minutes": resolution_minutes,
                    "data_points_used": len(parsed_data),
                    "confidence": round(avg_confidence, 3),
                    "sent_trend": sent_forecast["trend"],
                    "recv_trend": recv_forecast["trend"],
                    "generated_at": datetime.utcnow().isoformat() + "Z",
                },
            }

        except Exception as e:
            logger.error(f"Error in bandwidth prediction: {e}")
            return {
                "success": False,
                "error": str(e),
                "forecast": [],
            }

    def _parse_history(self, history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parse history data into consistent format.

        Args:
            history: Raw history data

        Returns:
            List of parsed data points
        """
        parsed = []

        for point in history:
            try:
                # Handle various timestamp formats
                ts = point.get("timestamp") or point.get("ts") or point.get("startTime")
                if not ts:
                    continue

                # Parse timestamp
                if isinstance(ts, str):
                    # Remove Z suffix and parse
                    ts_clean = ts.replace("Z", "+00:00")
                    try:
                        timestamp = datetime.fromisoformat(ts_clean)
                    except ValueError:
                        # Try parsing without timezone
                        timestamp = datetime.fromisoformat(ts.replace("Z", ""))
                elif isinstance(ts, (int, float)):
                    # Unix timestamp
                    timestamp = datetime.utcfromtimestamp(ts)
                else:
                    continue

                # Get values
                sent = point.get("sent", 0)
                recv = point.get("recv") or point.get("received", 0)

                if isinstance(sent, (int, float)) and isinstance(recv, (int, float)):
                    parsed.append({
                        "timestamp": timestamp,
                        "sent": float(sent),
                        "recv": float(recv),
                    })

            except Exception as e:
                logger.debug(f"Skipping data point: {e}")
                continue

        # Sort by timestamp
        parsed.sort(key=lambda x: x["timestamp"])
        return parsed

    def _linear_forecast(
        self,
        timestamps: List[datetime],
        values: List[float],
        forecast_hours: int,
        resolution_minutes: int,
    ) -> Dict[str, Any]:
        """Perform linear regression and forecast future values.

        Args:
            timestamps: List of datetime objects
            values: List of corresponding values
            forecast_hours: Hours to forecast
            resolution_minutes: Resolution in minutes

        Returns:
            Dict with forecast values and statistics
        """
        if len(timestamps) < 2:
            return {
                "values": [],
                "r_squared": 0,
                "trend": "unknown",
            }

        # Convert timestamps to numeric (minutes since first point)
        base_time = timestamps[0]
        x = [(t - base_time).total_seconds() / 60 for t in timestamps]
        y = values

        # Calculate linear regression coefficients
        n = len(x)
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xy = sum(xi * yi for xi, yi in zip(x, y))
        sum_x2 = sum(xi ** 2 for xi in x)

        # Calculate slope and intercept
        denominator = n * sum_x2 - sum_x ** 2
        if abs(denominator) < 1e-10:
            # No variance in x, use mean
            slope = 0
            intercept = sum_y / n if n > 0 else 0
        else:
            slope = (n * sum_xy - sum_x * sum_y) / denominator
            intercept = (sum_y - slope * sum_x) / n

        # Calculate R-squared
        y_mean = sum_y / n if n > 0 else 0
        ss_tot = sum((yi - y_mean) ** 2 for yi in y)
        ss_res = sum((yi - (slope * xi + intercept)) ** 2 for xi, yi in zip(x, y))

        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        r_squared = max(0, min(1, r_squared))  # Clamp to [0, 1]

        # Determine trend
        if abs(slope) < 0.01 * y_mean if y_mean > 0 else 1:
            trend = "stable"
        elif slope > 0:
            trend = "increasing"
        else:
            trend = "decreasing"

        # Generate forecast points
        last_x = x[-1] if x else 0
        forecast_values = []
        num_points = (forecast_hours * 60) // resolution_minutes

        for i in range(num_points):
            future_x = last_x + (i + 1) * resolution_minutes
            predicted = slope * future_x + intercept
            forecast_values.append(predicted)

        return {
            "values": forecast_values,
            "r_squared": r_squared,
            "trend": trend,
            "slope": slope,
            "intercept": intercept,
        }

    def get_prediction_for_device(
        self,
        device_serial: str,
        cache_service,
    ) -> Dict[str, Any]:
        """Get bandwidth prediction for a specific device.

        Args:
            device_serial: Device serial number
            cache_service: NetworkCacheService instance

        Returns:
            Prediction results
        """
        import asyncio

        async def _get_prediction():
            # Get cached bandwidth data
            cached_data = await cache_service.get_metrics(device_serial, "bandwidth")

            if not cached_data:
                return {
                    "success": False,
                    "error": "No cached bandwidth data available",
                    "device_serial": device_serial,
                }

            history = cached_data.get("history", [])
            if not history:
                return {
                    "success": False,
                    "error": "No historical data in cache",
                    "device_serial": device_serial,
                }

            # Generate prediction
            prediction = self.predict_bandwidth(history)
            prediction["device_serial"] = device_serial

            return prediction

        # Run async function
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If already in async context, create task
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(asyncio.run, _get_prediction())
                    return future.result()
            else:
                return asyncio.run(_get_prediction())
        except RuntimeError:
            return asyncio.run(_get_prediction())


# Singleton instance
_prediction_service: Optional[PredictionService] = None


def get_prediction_service() -> PredictionService:
    """Get or create the prediction service singleton.

    Returns:
        PredictionService instance
    """
    global _prediction_service
    if _prediction_service is None:
        _prediction_service = PredictionService()
    return _prediction_service
