package com.smartinventory.controller;

import com.smartinventory.entity.InventoryTransaction;
import com.smartinventory.entity.Product;
import com.smartinventory.service.InventoryService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/products")
    public ResponseEntity<List<Product>> getAllProducts() {
        return ResponseEntity.ok(inventoryService.getAllProducts());
    }

    @PostMapping("/products")
    public ResponseEntity<Product> addProduct(@RequestBody Product product) {
        return ResponseEntity.ok(inventoryService.addProduct(product));
    }

    @PostMapping("/transaction")
    public ResponseEntity<?> processTransaction(@RequestBody TransactionRequest request) {
        try {
            Product updatedProduct = inventoryService.processStockTransaction(
                    request.getProductId(),
                    request.getQuantity(),
                    request.getType(),
                    request.getReason(),
                    null // TODO: Get authenticated user
            );
            return ResponseEntity.ok(updatedProduct);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @Data
    static class TransactionRequest {
        private Long productId;
        private Integer quantity;
        private InventoryTransaction.TransactionType type;
        private String reason;
    }
}
