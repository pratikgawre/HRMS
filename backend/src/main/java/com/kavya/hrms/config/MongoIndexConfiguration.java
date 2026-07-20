package com.kavya.hrms.config;

import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.Asset;
import com.kavya.hrms.model.AssetAssignment;
import com.kavya.hrms.model.AssetRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.IndexOperations;

@Configuration
public class MongoIndexConfiguration {
  private static final Logger log = LoggerFactory.getLogger(MongoIndexConfiguration.class);
  private static final String APP_USER_IDENTITY_FIELD = "systemUserIdentityKey";
  private static final String APP_USER_IDENTITY_INDEX = "systemUserIdentityKey";

  @Bean
  @Order(Ordered.HIGHEST_PRECEDENCE)
  public ApplicationRunner appUserIdentityIndexRunner(MongoTemplate mongoTemplate) {
    return args -> reconcileAppUserIdentityIndex(mongoTemplate);
  }


  @Bean
  @Order(Ordered.HIGHEST_PRECEDENCE + 1)
  public ApplicationRunner assetIndexesRunner(MongoTemplate mongoTemplate) {
    return args -> createAssetIndexes(mongoTemplate);
  }
  private void reconcileAppUserIdentityIndex(MongoTemplate mongoTemplate) {
    IndexOperations indexOperations = mongoTemplate.indexOps(AppUser.class);
    for (IndexInfo indexInfo : indexOperations.getIndexInfo()) {
      if (isAppUserIdentityIndex(indexInfo) && !hasExpectedOptions(indexInfo)) {
        log.info(
            "Dropping incompatible Mongo index '{}' on app_users.{} so it can be recreated as unique sparse.",
            indexInfo.getName(),
            APP_USER_IDENTITY_FIELD);
        indexOperations.dropIndex(indexInfo.getName());
        break;
      }
    }

    indexOperations.createIndex(new Index()
        .on(APP_USER_IDENTITY_FIELD, Sort.Direction.ASC)
        .unique()
        .sparse()
        .named(APP_USER_IDENTITY_INDEX));
  }


  private void createAssetIndexes(MongoTemplate mongoTemplate) {
    mongoTemplate.indexOps(Asset.class).createIndex(new Index()
        .on("assetCode", Sort.Direction.ASC)
        .named("assetCode"));
    mongoTemplate.indexOps(Asset.class).createIndex(new Index()
        .on("assignedToEmployeeId", Sort.Direction.ASC)
        .named("assignedToEmployeeId"));
    mongoTemplate.indexOps(Asset.class).createIndex(new Index()
        .on("status", Sort.Direction.ASC)
        .named("status"));

    mongoTemplate.indexOps(AssetAssignment.class).createIndex(new Index()
        .on("employeeId", Sort.Direction.ASC)
        .on("assignedDate", Sort.Direction.DESC)
        .named("employeeId_assignedDate"));
    mongoTemplate.indexOps(AssetAssignment.class).createIndex(new Index()
        .on("assetId", Sort.Direction.ASC)
        .on("assignedDate", Sort.Direction.DESC)
        .named("assetId_assignedDate"));
    mongoTemplate.indexOps(AssetAssignment.class).createIndex(new Index()
        .on("assetCode", Sort.Direction.ASC)
        .on("assignedDate", Sort.Direction.DESC)
        .named("assetCode_assignedDate"));

    mongoTemplate.indexOps(AssetRequest.class).createIndex(new Index()
        .on("employeeId", Sort.Direction.ASC)
        .on("createdDate", Sort.Direction.DESC)
        .named("employeeId_createdDate"));
    mongoTemplate.indexOps(AssetRequest.class).createIndex(new Index()
        .on("assetId", Sort.Direction.ASC)
        .on("createdDate", Sort.Direction.DESC)
        .named("assetId_createdDate"));
  }
  private boolean isAppUserIdentityIndex(IndexInfo indexInfo) {
    if (APP_USER_IDENTITY_INDEX.equals(indexInfo.getName())) {
      return true;
    }

    return indexInfo.getIndexFields().stream()
        .map(indexField -> indexField.getKey())
        .anyMatch(APP_USER_IDENTITY_FIELD::equals);
  }

  private boolean hasExpectedOptions(IndexInfo indexInfo) {
    return indexInfo.isUnique() && indexInfo.isSparse();
  }
}
