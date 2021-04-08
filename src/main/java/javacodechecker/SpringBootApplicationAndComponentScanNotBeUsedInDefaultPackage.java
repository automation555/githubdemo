
import org.springframework.boot.SpringApplication;
//EMB-ISSUE: CodeIssueNames.SPRINGBOOTAPPLICATION_AND_COMPONENTSCAN_NOT_BE_USED_IN_DEFAULT_PACKAGE
@ComponentScan(exclude=Book.class,scanBasePackages={"net.javabeat"})
public class SpringBootApplicationAndComponentScanNotBeUsedInDefaultPackage {
   public static void main(String[] args) 
   {
      SpringApplication.run(SpringBootApplicationAndComponentScanNotBeUsedInDefaultPackage.class, args);
   }
}