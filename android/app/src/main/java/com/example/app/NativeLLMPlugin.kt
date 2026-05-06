package com.example.app

import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(name = "NativeLLM")
class NativeLLMPlugin : Plugin() {
    private var llmInference: LlmInference? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    @PluginMethod
    fun initModel(call: PluginCall) {
        val modelFileName = call.getString("modelPath") ?: "gemma-2b-it-cpu-int4.bin"
        
        scope.launch {
            try {
                val context = context
                // MediaPipe needs a file on disk, not just an asset
                val modelFile = File(context.filesDir, modelFileName)
                
                if (!modelFile.exists()) {
                    // Copy from assets to internal storage if it doesn't exist
                    withContext(Dispatchers.IO) {
                        context.assets.open(modelFileName).use { inputStream ->
                            FileOutputStream(modelFile).use { outputStream ->
                                inputStream.copyTo(outputStream)
                            }
                        }
                    }
                }

                val options = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(modelFile.absolutePath)
                    .setMaxTokens(1024)
                    .setTopK(40)
                    .setTemperature(0.1f)
                    .build()

                llmInference = LlmInference.createFromOptions(context, options)
                
                withContext(Dispatchers.Main) {
                    call.resolve()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    call.reject("Model Init Failed: ${e.message}")
                }
            }
        }
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val prompt = call.getString("prompt") ?: return call.reject("No prompt provided")
        
        if (llmInference == null) {
            return call.reject("Model not initialized. Call initModel first.")
        }

        scope.launch {
            try {
                // Background Inference to keep UI smooth
                val result = llmInference?.generateResponse(prompt)
                
                val ret = JSObject()
                ret.put("response", result)
                
                withContext(Dispatchers.Main) {
                    call.resolve(ret)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    call.reject("Inference Error: ${e.message}")
                }
            }
        }
    }
}
