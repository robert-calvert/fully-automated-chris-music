import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { z, ZodError, ZodType } from "zod";

const REQUEST_TIMEOUT_MILLIS = 10000;
const RETRY_DELAY_MILLIS = 3000;

export async function apiGet<T>(
    requestUrl: string,
    validationSchema: ZodType<T>,
    headers?: Record<string, string>
): Promise<T> {
    return handleAxiosResponse(
        await requestWithRetry({
            method: "GET",
            url: requestUrl,
            headers,
            timeout: REQUEST_TIMEOUT_MILLIS,
        }),
        validationSchema
    );
}

export async function apiPost<T>(
    requestUrl: string,
    requestBody: Record<string, any>,
    validationSchema: ZodType<T>,
    headers?: Record<string, string>
): Promise<T> {
    return handleAxiosResponse(
        await requestWithRetry({
            method: "POST",
            url: requestUrl,
            data: requestBody,
            headers,
            timeout: REQUEST_TIMEOUT_MILLIS,
        }),
        validationSchema
    );
}

export async function apiDelete<T>(
    requestUrl: string,
    requestBody: Record<string, any>,
    validationSchema: ZodType<T>,
    headers?: Record<string, string>
): Promise<T> {
    return handleAxiosResponse(
        await requestWithRetry({
            method: "DELETE",
            url: requestUrl,
            data: requestBody,
            headers,
            timeout: REQUEST_TIMEOUT_MILLIS,
        }),
        validationSchema
    );
}

async function requestWithRetry(
    config: AxiosRequestConfig,
    retries: number = 1
): Promise<AxiosResponse> {
    let attempt = 0;
    while (true) {
        try {
            const response = await axios.request(config);
            if (response.status >= 500 && attempt < retries) {
                attempt++;
                await new Promise((resolve) =>
                    setTimeout(resolve, RETRY_DELAY_MILLIS)
                );
                continue;
            }

            return response;
        } catch (error: unknown) {
            console.error(
                "requestWithRetry",
                new Date().toLocaleString("en-GB")
            );
            console.error("Request Config:", JSON.stringify(config, null, 2));

            if (axios.isAxiosError(error)) {
                console.error("Axios Code:", error.code);
                console.error("Axios Message:", error.message);
                console.error("Axios Cause:", error.cause);
                console.error(
                    "Axios Response:",
                    error.response?.status,
                    error.response?.data
                );

                throw new Error(
                    error.response?.data
                        ? JSON.stringify(error.response.data)
                        : `Axios Error: ${error.message} (${error.code})`
                );
            }

            throw error;
        }
    }
}

async function handleAxiosResponse<T>(
    response: AxiosResponse,
    validationSchema: ZodType<T>
): Promise<T> {
    try {
        const responseBody = validationSchema.parse(response.data);
        return responseBody;
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            throw new Error(z.prettifyError(error));
        }

        throw error;
    }
}
