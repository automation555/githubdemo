package javacodechecker;
import org.springframework.boot.SpringApplication;
//EMB-ISSUE: CodeIssueNames.SPRINGBOOTAPPLICATION_AND_COMPONENTSCAN_NOT_BE_USED_IN_DEFAULT_PACKAGE/no-detect
@SpringBootApplication
public class SpringBootApplicationAndComponentScanNotBeUsedInDefaultPackageExample {
   public static void main(String[] args) 
   {
      SpringApplication.run(SpringBootApplicationAndComponentScanNotBeUsedInDefaultPackageExample.class, args);
   }
}