package com.kavya.hrms.controller;

import com.mongodb.client.gridfs.model.GridFSFile;
import org.bson.types.ObjectId;
import org.springframework.core.io.Resource;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class TaskAttachmentController {
  private final GridFsTemplate gridFsTemplate;

  public TaskAttachmentController(GridFsTemplate gridFsTemplate) {
    this.gridFsTemplate = gridFsTemplate;
  }

  @GetMapping("/uploads/task-attachments/{id}")
  @SuppressWarnings("SPRING_DATA_STRING_PROPERTY_REFERENCE")
  public ResponseEntity<Resource> getTaskAttachment(@PathVariable String id) {
    ObjectId objectId = parseObjectId(id);
    GridFSFile file = gridFsTemplate.findOne(Query.query(Criteria.where("_id").is(objectId)));
    if (file == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found");
    }

    GridFsResource resource = gridFsTemplate.getResource(file);
    String filename = firstNonBlank(file.getFilename(), "task-attachment");
    String contentType = firstNonBlank(resource.getContentType(), "application/octet-stream");

    return ResponseEntity.ok()
        .contentType(parseMediaType(contentType))
        .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(filename).build().toString())
        .body(resource);
  }

  private ObjectId parseObjectId(String id) {
    try {
      return new ObjectId(id);
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found", exception);
    }
  }

  private MediaType parseMediaType(String value) {
    try {
      return MediaType.parseMediaType(value);
    } catch (IllegalArgumentException exception) {
      return MediaType.APPLICATION_OCTET_STREAM;
    }
  }

  private String firstNonBlank(String... values) {
    if (values == null) {
      return "";
    }

    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value.trim();
      }
    }

    return "";
  }
}
